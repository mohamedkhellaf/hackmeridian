"""
Strata Pro — moteur de risque de référence.

Rôle : fixer exactement ce que le publieur de risque calcule hors chaîne et ce que
le contrat Soroban vérifie. Les flottants servent à la recherche et à la calibration ;
la section `onchain_*` reproduit l'arithmétique entière (i128, 7 décimales) que le
contrat doit implémenter, avec arrondis conservateurs.

Convention : NLV (valeur nette de liquidation) = cash + tokens décotés
             + longs décotés - valeur des shorts.
             Sain si NLV >= MM, liquidable si NLV < MM, ouverture/retrait si NLV_après >= IM.
             (Équivalent à C >= L + stress + add-ons de la spec.)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

HOURS_PER_DAY = 7          # points de contrôle par séance (oracle vivant)
DAYS_PER_YEAR = 252
STEPS_PER_YEAR = HOURS_PER_DAY * DAYS_PER_YEAR
SQRT2 = math.sqrt(2.0)


# --------------------------------------------------------------------------- pricing

def ncdf(x):
    """Loi normale cumulée (Abramowitz–Stegun 7.1.26, erreur < 1.5e-7)."""
    x = np.asarray(x, dtype=float)
    z = np.abs(x) / SQRT2
    t = 1.0 / (1.0 + 0.3275911 * z)
    poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
    erf = np.sign(x) * (1.0 - poly * np.exp(-z * z))
    return 0.5 * (1.0 + erf)


def _arrays(*xs):
    return tuple(np.array(a, dtype=float) for a in np.broadcast_arrays(*xs))


def _d1(S, K, tau, sigma, r, q):
    vt = sigma * np.sqrt(tau)
    return (np.log(S / K) + (r - q + 0.5 * sigma * sigma) * tau) / vt, vt


def bs_call(S, K, tau, sigma, r=0.0, q=0.0):
    S, tau, sigma = _arrays(S, tau, sigma)
    shape = np.shape(S)
    S, tau, sigma = (a.ravel() for a in (S, tau, sigma))
    # Limite tau -> 0 ou sigma -> 0 : intrinsèque forward.
    out = np.maximum(S * np.exp(-q * tau) - K * np.exp(-r * tau), 0.0)
    m = (tau > 0) & (sigma > 0)
    if np.any(m):
        s, t, v = S[m], tau[m], sigma[m]
        d1, vt = _d1(s, K, t, v, r, q)
        out[m] = s * np.exp(-q * t) * ncdf(d1) - K * np.exp(-r * t) * ncdf(d1 - vt)
    return out.reshape(shape)


def bs_put(S, K, tau, sigma, r=0.0, q=0.0):
    tau = np.asarray(tau, dtype=float)
    return bs_call(S, K, tau, sigma, r, q) - np.asarray(S) * np.exp(-q * tau) + K * np.exp(-r * tau)


def bs_price(kind, S, K, tau, sigma, r=0.0, q=0.0):
    return bs_call(S, K, tau, sigma, r, q) if kind == "C" else bs_put(S, K, tau, sigma, r, q)


def bs_delta(kind, S, K, tau, sigma, r=0.0, q=0.0):
    S, tau, sigma = _arrays(S, tau, sigma)
    shape = np.shape(S)
    S, tau, sigma = (a.ravel() for a in (S, tau, sigma))
    call = (S > K).astype(float)
    m = (tau > 0) & (sigma > 0)
    if np.any(m):
        d1, _ = _d1(S[m], K, tau[m], sigma[m], r, q)
        call[m] = np.exp(-q * tau[m]) * ncdf(d1)
    out = call if kind == "C" else call - np.exp(-q * tau)
    return out.reshape(shape)


# --------------------------------------------------------------------------- marge par scénarios

@dataclass(frozen=True)
class Series:
    kind: str     # "C" ou "P"
    K: float
    tau: float    # années restantes
    funded: bool = False   # True : obligation du vendeur intégralement préfinancée (Covered / Defined Risk)


@dataclass(frozen=True)
class ScanConfig:
    """Marge par scénarios, structure SPAN à 16 scénarios."""
    psr: float                  # price scan range U, fraction du spot
    vol_shift: float = 0.25     # vol x (1 ± vol_shift)
    ext_mult: float = 3.0       # scénarios extrêmes à ± ext_mult * U
    ext_weight: float = 1.0     # 0.35 = SPAN classique ; Strata : 1.0 (queue non sous-pondérée)
    short_min: float = 0.05     # plancher par lot court, fraction du spot
    long_haircut: float = 0.5   # crédit des longs dont le vendeur est lui-même sur marge
    token_haircut: float = 0.15
    liq_y: float = 1.0          # coefficient de la loi d'impact en racine carrée
    adv: float = 50_000.0       # volume quotidien réellement accessible du token
    im_mult: float = 1.25       # IM = 1.25 x MM (hystérésis)

    def scenarios(self):
        """(variation de prix, multiplicateur de vol, poids) — 14 + 2 extrêmes."""
        out = []
        for k in (0.0, 1 / 3, -1 / 3, 2 / 3, -2 / 3, 1.0, -1.0):
            for v in (1 + self.vol_shift, 1 - self.vol_shift):
                out.append((k * self.psr, v, 1.0))
        out.append((self.ext_mult * self.psr, 1.0, self.ext_weight))
        out.append((-self.ext_mult * self.psr, 1.0, self.ext_weight))
        return out


def price_scan_range(sigma_eff, horizon_days, z=3.0, floor=0.05, jump_addon=0.0):
    """U = max(plancher, z * sigma_eff * sqrt(H)) + add-on de saut. Paramètres de stress, pas une probabilité."""
    return max(floor, z * sigma_eff * math.sqrt(horizon_days / DAYS_PER_YEAR)) + jump_addon


def risk_array(series: Series, S, sigma, cfg: ScanConfig, r=0.0, q=0.0):
    """P&L pondéré d'UN lot long par scénario. Forme (16, *S.shape). Le publieur signe ce tableau."""
    S = np.asarray(S, dtype=float)
    base = bs_price(series.kind, S, series.K, series.tau, sigma, r, q)
    rows = [w * (bs_price(series.kind, S * (1 + u), series.K, series.tau, sigma * v, r, q) - base)
            for u, v, w in cfg.scenarios()]
    return np.stack(rows)


def liquidity_cost(qty, S, sigma, adv, y=1.0):
    """Coût de sortie loi racine carrée : y * sigma_jour * S * qty * sqrt(qty / ADV)."""
    qty = np.abs(np.asarray(qty, dtype=float))
    return y * sigma / math.sqrt(DAYS_PER_YEAR) * np.asarray(S) * qty * np.sqrt(qty / adv)


@dataclass
class Account:
    cash: float
    tokens: float = 0.0
    positions: dict = field(default_factory=dict)   # Series -> qty (>0 long, <0 short)


def account_risk(acc: Account, S: float, sigma: float, cfg: ScanConfig, r=0.0, q=0.0):
    """Marge de portefeuille d'un compte sur UN sous-jacent (pas de compensation inter-sous-jacents)."""
    scen = cfg.scenarios()
    nlv = acc.cash + acc.tokens * S * (1 - cfg.token_haircut)
    pnl = np.array([w * acc.tokens * S * u for u, _, w in scen])
    shorts, net_delta = 0.0, acc.tokens
    for s, qty in acc.positions.items():
        # Un long n'est une couverture que si son propre vendeur paiera : crédit plein si préfinancé.
        eff = qty if (qty < 0 or s.funded) else qty * (1 - cfg.long_haircut)
        nlv += eff * float(bs_price(s.kind, S, s.K, s.tau, sigma, r, q))
        pnl += eff * risk_array(s, S, sigma, cfg, r, q)
        net_delta += qty * float(bs_delta(s.kind, S, s.K, s.tau, sigma, r, q))
        if qty < 0:
            shorts += -qty
    scan = max(0.0, -float(pnl.min()))
    smin = shorts * cfg.short_min * S
    liq = float(liquidity_cost(net_delta, S, sigma, cfg.adv, cfg.liq_y))
    mm = max(scan, smin) + liq
    return {"nlv": nlv, "scan": scan, "short_min": smin, "liq": liq, "net_delta": net_delta,
            "mm": mm, "im": cfg.im_mult * mm, "worst_scenario": int(pnl.argmin()),
            "liquidable": nlv < mm}


@dataclass(frozen=True)
class FixedPctConfig:
    """Référence TradFi type FINRA 4210 : max(20% S - OTM, 10% S) par lot, en plus de la valeur de l'option."""
    base: float = 0.20
    floor: float = 0.10
    im_mult: float = 1.25


def fixedpct_short_call(S, K, Q, cfg: FixedPctConfig):
    S = np.asarray(S, dtype=float)
    return Q * np.maximum(cfg.base * S - np.maximum(K - S, 0.0), cfg.floor * S)


# --------------------------------------------------------------------------- liquidation et défaut

def takeover_price(series: Series, mark: float, S: float, bonus: float, max_bonus: float = 0.10):
    """Prix de reprise par lot. Bornes on-chain anti-collusion : intrinsèque <= mark <= borne d'arbitrage."""
    intrinsic = max(S - series.K, 0.0) if series.kind == "C" else max(series.K - S, 0.0)
    upper = S if series.kind == "C" else series.K
    if not (intrinsic - 1e-9 <= mark <= upper + 1e-9):
        raise ValueError("mark hors bornes d'arbitrage : snapshot rejeté")
    if not 0.0 <= bonus <= max_bonus:
        raise ValueError("bonus hors plafond publié")
    return mark * (1 + bonus)


def partial_takeover(acc: Account, S, sigma, cfg: ScanConfig, bonus: float, tol=1e-6):
    """Plus petite fraction f des shorts transférée au repreneur pour revenir à NLV >= IM.
    Renvoie (f, compte après, montant versé au repreneur). f=1 et NLV<0 => insolvable."""
    def after(f):
        new = Account(acc.cash, acc.tokens, dict(acc.positions))
        paid = 0.0
        for s, qty in acc.positions.items():
            if qty < 0:
                mark = float(bs_price(s.kind, S, s.K, s.tau, sigma))
                paid += takeover_price(s, mark, S, bonus) * (-qty) * f
                new.positions[s] = qty * (1 - f)
        new.cash -= paid
        return new, paid

    if account_risk(acc, S, sigma, cfg)["nlv"] >= account_risk(acc, S, sigma, cfg)["im"]:
        return 0.0, acc, 0.0
    lo, hi = 0.0, 1.0
    full, paid = after(1.0)
    r = account_risk(full, S, sigma, cfg)
    if r["nlv"] < r["im"]:
        return 1.0, full, paid
    while hi - lo > tol:
        mid = (lo + hi) / 2
        a, _ = after(mid)
        r = account_risk(a, S, sigma, cfg)
        lo, hi = (mid, hi) if r["nlv"] < r["im"] else (lo, mid)
    new, paid = after(hi)
    return hi, new, paid


WATERFALL = ("marge_defaillant", "contribution_df_defaillant", "first_loss_backstop",
             "fonds_mutualise", "haircut_longs")


def default_waterfall(loss: float, resources: dict):
    """Alloue une perte couche par couche. La dernière couche est une réduction pro rata des créances longues."""
    alloc, remaining = {}, loss
    for layer in WATERFALL[:-1]:
        take = min(remaining, max(resources.get(layer, 0.0), 0.0))
        alloc[layer] = take
        remaining -= take
    alloc["haircut_longs"] = remaining
    long_claims = resources.get("creances_longues", 0.0)
    alloc["taux_haircut_longs"] = remaining / long_claims if long_claims > 0 else (1.0 if remaining > 0 else 0.0)
    return alloc


def settle_cash_call(Q, K, S_T, margin, reserve):
    """Règlement Pro : payé = min(dû, marge + réserve) ; marge consommée avant la réserve."""
    due = Q * max(S_T - K, 0.0)
    from_margin = min(due, margin)
    from_reserve = min(due - from_margin, reserve)
    paid = from_margin + from_reserve
    return {"due": due, "paid": paid, "deficit": due - paid, "writer_refund": margin - from_margin,
            "reserve_released": reserve - from_reserve}


def guaranteed_cover_price(Q, K, margin, reserve):
    """Prix jusqu'auquel le payoff d'Alice est intégralement couvert SANS liquidation : K + (C+R)/Q."""
    return K + (margin + reserve) / Q


def max_open_interest(reserve, shortfall_per_lot_tail):
    """Livre entièrement corrélé (tous les makers courts sur le même sous-jacent) :
    le déficit agrégé croît linéairement avec l'OI => OI_max = réserve / déficit de queue par lot."""
    return float("inf") if shortfall_per_lot_tail <= 0 else reserve / shortfall_per_lot_tail


# --------------------------------------------------------------------------- simulateur de calibration

@dataclass(frozen=True)
class MarketModel:
    name: str
    S0: float = 100.0
    sigma: float = 0.35
    overnight_var_frac: float = 0.30   # part de la variance quotidienne hors séance
    jump_lambda: float = 4.0           # sauts / an, survenant hors séance (résultats, nouvelles)
    jump_mu: float = 0.0
    jump_sd: float = 0.08
    weekend_jump_mult: float = 3.0
    adv: float = 50_000.0


@dataclass(frozen=True)
class OpsModel:
    lag_steps: int = 1          # délai détection -> exécution (heures de séance)
    liq_stress_mult: float = 2.0  # la profondeur se dégrade au moment de la liquidation
    bonus: float = 0.05         # rémunération du repreneur au-dessus du mark
    withdraw_to_im: bool = True   # maker efficace : retire tout excédent au-dessus de l'IM
    top_up: bool = False          # True : recharge à l'IM à chaque contrôle ; ne fait défaut que sur un gap


def _requirement(margin, S, tau, K, Q, sigma, adv):
    """(MM, IM) vectorisés pour un livre « Q calls courts ».
    margin : ScanConfig (scénarios) ou FixedPctConfig (référence TradFi)."""
    if isinstance(margin, FixedPctConfig):
        mm = fixedpct_short_call(S, K, Q, margin)
        return mm, margin.im_mult * mm
    ra = risk_array(Series("C", K, tau), S, sigma, margin)        # P&L d'un long
    scan = np.maximum(0.0, (Q * ra).max(axis=0))                   # perte du short = gain du long
    smin = Q * margin.short_min * S
    delta = bs_delta("C", S, K, tau, sigma)
    liq = liquidity_cost(Q * delta, S, sigma, adv, margin.liq_y)
    mm = np.maximum(scan, smin) + liq
    return mm, margin.im_mult * mm


def simulate(market: MarketModel, margin, ops: OpsModel, K=110.0, days=21, Q=1_000.0,
             n_paths=20_000, seed=7):
    """Un maker vend Q calls européens cash, dépose exactement l'IM, ne recharge jamais (adversarial),
    retire l'excédent au-dessus de l'IM. Liquidation = reprise complète au mark + bonus + coût de sortie,
    exécutée `lag_steps` après détection. Mesure le déficit (perte non couverte par la marge)."""
    rng = np.random.default_rng(seed)
    n_steps = days * HOURS_PER_DAY
    sig = market.sigma
    var_day = sig * sig / DAYS_PER_YEAR
    var_intra = var_day * (1 - market.overnight_var_frac) / (HOURS_PER_DAY - 1)
    var_night = var_day * market.overnight_var_frac
    p_jump = market.jump_lambda / DAYS_PER_YEAR

    S = np.full(n_paths, market.S0)
    tau0 = n_steps / STEPS_PER_YEAR
    V0 = float(bs_call(market.S0, K, tau0, sig))
    mm0, im0 = (float(x[0]) for x in _requirement(margin, np.array([market.S0]), tau0, K, Q, sig, market.adv))
    C = np.full(n_paths, Q * V0 + im0)     # prime bloquée + dépôt = IM
    alive = np.ones(n_paths, bool)
    pending = np.full(n_paths, -1)
    shortfall = np.zeros(n_paths)
    liquidated = np.zeros(n_paths, bool)
    topups = np.zeros(n_paths)

    for step in range(1, n_steps + 1):
        d, h = divmod(step, HOURS_PER_DAY)
        if h == 0:   # ouverture du jour d : saut de nuit (ou de week-end)
            weekend = d % 5 == 0
            var = var_night * (1.5 if weekend else 1.0)
            pj = p_jump * (market.weekend_jump_mult if weekend else 1.0)
            jumps = (rng.random(n_paths) < pj) * rng.normal(market.jump_mu, market.jump_sd, n_paths)
            ret = rng.normal(-0.5 * var, math.sqrt(var), n_paths) + jumps
        else:
            ret = rng.normal(-0.5 * var_intra, math.sqrt(var_intra), n_paths)
        S = S * np.exp(ret)
        tau = (n_steps - step) / STEPS_PER_YEAR

        ex = alive & (pending == step)
        if ex.any():
            Se = S[ex]
            cost = (Q * bs_call(Se, K, tau, sig) * (1 + ops.bonus)
                    + ops.liq_stress_mult * liquidity_cost(Q * bs_delta("C", Se, K, tau, sig), Se, sig, market.adv))
            shortfall[ex] = np.maximum(cost - C[ex], 0.0)
            alive[ex], liquidated[ex] = False, True

        if step == n_steps:
            due = Q * np.maximum(S[alive] - K, 0.0)
            shortfall[alive] = np.maximum(due - C[alive], 0.0)
            break

        chk = alive & (pending < 0)
        if chk.any():
            Sc = S[chk]
            nlv = C[chk] - Q * bs_call(Sc, K, tau, sig)
            mm, im = _requirement(margin, Sc, tau, K, Q, sig, market.adv)
            trig = nlv < mm
            idx = np.flatnonzero(chk)
            if step + ops.lag_steps < n_steps:
                pending[idx[trig]] = step + ops.lag_steps
            # sinon : déclenché trop tard, le règlement à l'échéance tranche
            if ops.withdraw_to_im:
                w = (~trig) & (nlv > im)
                C[idx[w]] -= (nlv - im)[w]
            if ops.top_up:
                t = (~trig) & (nlv < im)
                C[idx[t]] += (im - nlv)[t]
                topups[idx[t]] += (im - nlv)[t]

    per_lot = shortfall / Q
    tail = per_lot[per_lot > 0]
    return {
        "market": market.name, "margin": _label(margin),
        "maker": "actif (recharge)" if ops.top_up else "passif (ne recharge jamais)",
        "IM_open_pct_notional": im0 / (Q * market.S0),
        "premium_per_lot": V0,
        "p_liquidation": liquidated.mean(),
        "p_shortfall": (shortfall > 0).mean(),
        "EL_per_lot": per_lot.mean(),
        "ES_given_shortfall_per_lot": tail.mean() if tail.size else 0.0,
        "q99_per_lot": float(np.quantile(per_lot, 0.99)),
        "q999_per_lot": float(np.quantile(per_lot, 0.999)),
        "topups_per_lot": topups.mean() / Q,
    }


def _label(m):
    if isinstance(m, FixedPctConfig):
        return f"fixe {m.base:.0%}/{m.floor:.0%}"
    return f"scan U={m.psr:.0%} ext x{m.ext_mult:g} w{m.ext_weight:g} min{m.short_min:.0%}"


# --------------------------------------------------------------------------- arithmétique on-chain (i128)

SCALE = 10_000_000   # 7 décimales, unités Stellar


def ceil_div(a: int, b: int) -> int:
    return -((-a) // b)


def to_units_up(x: float) -> int:
    return math.ceil(round(x * SCALE, 6))


def to_units_down(x: float) -> int:
    return math.floor(round(x * SCALE, 6))


def onchain_requirement(positions_lots, risk_arrays_units, mark_units, smin_units, liq_units_per_lot,
                        qty_scale=1):
    """Ce que fait le contrat : algèbre entière linéaire, aucune exp/log on-chain.
    positions_lots : {series_id: qty signée}. risk_arrays_units : P&L par lot LONG, déjà arrondi
    conservateurement par le publieur (gains vers le bas, pertes vers le haut).
    Renvoie (valeur des shorts - longs crédités, exigence MM) en unités."""
    n = len(next(iter(risk_arrays_units.values())))
    pnl = [0] * n
    liability, shorts, liq = 0, 0, 0
    for sid, q in positions_lots.items():
        for k in range(n):
            pnl[k] += q * risk_arrays_units[sid][k]
        liability -= q * mark_units[sid]
        if q < 0:
            shorts += (-q) * smin_units[sid]
            liq += (-q) * liq_units_per_lot[sid]
    scan = max(0, -min(pnl))
    return liability, max(scan, shorts) + liq


if __name__ == "__main__":
    import json
    import sys

    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20_000
    normal = MarketModel("action tech liquide", sigma=0.35, jump_lambda=4, jump_sd=0.08, adv=50_000)
    stress = MarketModel("RWA tokenisé fin", sigma=0.60, jump_lambda=10, jump_sd=0.15, adv=10_000)
    from dataclasses import replace
    ops_n = OpsModel(lag_steps=1, liq_stress_mult=2.0)
    ops_s = OpsModel(lag_steps=3, liq_stress_mult=3.0)

    def scan_for(mk, U, **kw):
        return ScanConfig(psr=U, adv=mk.adv, **kw)

    rows = []
    for mk, ops in ((normal, ops_n), (stress, ops_s)):
        configs = [
            FixedPctConfig(),
            scan_for(mk, 0.10, ext_weight=0.35),                 # SPAN « classique »
            scan_for(mk, 0.15, ext_weight=1.0, ext_mult=2.0),
            scan_for(mk, 0.20, ext_weight=1.0, ext_mult=2.0, short_min=0.10),
            scan_for(mk, 0.30, ext_weight=1.0, ext_mult=2.0, short_min=0.10),
        ]
        for cfg in configs:
            for o in (ops, replace(ops, top_up=True)):
                rows.append(simulate(mk, cfg, o, n_paths=n))
    sys.stdout.reconfigure(encoding="utf-8")
    hdr = ("marché", "marge", "maker", "IM/notionnel", "P(liq)", "P(déficit)", "EL/lot", "ES|déf/lot", "q99.9/lot")
    print(" | ".join(hdr))
    for r in rows:
        print(" | ".join([r["market"], r["margin"], r["maker"], f"{r['IM_open_pct_notional']:.1%}",
                          f"{r['p_liquidation']:.1%}", f"{r['p_shortfall']:.2%}", f"{r['EL_per_lot']:.4f}",
                          f"{r['ES_given_shortfall_per_lot']:.2f}", f"{r['q999_per_lot']:.2f}"]))
    if "--json" in sys.argv:
        print(json.dumps(rows, indent=1, ensure_ascii=False))
