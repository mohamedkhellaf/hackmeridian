"""Fixtures et tests du moteur de risque. Les valeurs ici sont celles que Dev2 recopie en tests Soroban.
Lancer : python test_strata_risk.py"""
import math

import numpy as np

from strata_risk import (Account, ScanConfig, Series, account_risk, bs_call, bs_put, default_waterfall,
                         guaranteed_cover_price, max_open_interest, onchain_requirement, partial_takeover,
                         risk_array, settle_cash_call, takeover_price, to_units_down, to_units_up)


def close(a, b, tol=1e-6):
    assert abs(a - b) <= tol, (a, b)


def test_pricing():
    # Parité call-put et limite à l'échéance.
    c, p = float(bs_call(100, 110, 0.25, 0.35)), float(bs_put(100, 110, 0.25, 0.35))
    close(c - p, 100 - 110)
    close(float(bs_call(120, 100, 0.0, 0.35)), 20.0)
    close(float(bs_call(90, 100, 0.5, 0.0)), 0.0)
    # Valeur de référence Hull (S=42, K=40, r=10%, sigma=20%, T=0.5) : 4.76
    close(float(bs_call(42, 40, 0.5, 0.2, r=0.10)), 4.7594, 1e-3)


def test_settlement_spec_cases():
    s = settle_cash_call(Q=10, K=100, S_T=145, margin=300, reserve=100)        # dû 450
    assert (s["paid"], s["deficit"], s["reserve_released"]) == (400, 50, 0)
    s = settle_cash_call(Q=10, K=100, S_T=120, margin=300, reserve=100)        # dû 200
    assert (s["paid"], s["writer_refund"], s["reserve_released"]) == (200, 100, 100)
    # Le payoff « non plafonné » est garanti sans liquidation jusqu'à K + (C+R)/Q seulement.
    close(guaranteed_cover_price(10, 100, 300, 100), 140.0)


def test_takeover_spec_case_and_bounds():
    # Spec : C=340, mark total 230, X=250, nouvel IM 450 => 790 entrants, 450 bloqués, 250 repreneur, 90 ancien vendeur.
    C_old, X, im_new = 340, 250, 450
    assert C_old + im_new == im_new + X + (C_old - X) == 790
    s = Series("C", 100, 0.05)
    close(takeover_price(s, 23.0, 120.0, bonus=20 / 230), 25.0)
    for bad_mark in (19.0, 121.0):           # sous l'intrinsèque, au-dessus du spot
        try:
            takeover_price(s, bad_mark, 120.0, 0.05)
            raise AssertionError("snapshot hors bornes accepté")
        except ValueError:
            pass
    try:                                      # bonus au-delà du plafond => collusion bloquée
        takeover_price(s, 23.0, 120.0, 0.5)
        raise AssertionError("bonus hors plafond accepté")
    except ValueError:
        pass


def test_waterfall_order():
    a = default_waterfall(1_000, {"marge_defaillant": 300, "contribution_df_defaillant": 100,
                                  "first_loss_backstop": 200, "fonds_mutualise": 250,
                                  "creances_longues": 5_000})
    assert a["marge_defaillant"] == 300 and a["fonds_mutualise"] == 250
    close(a["haircut_longs"], 150)
    close(a["taux_haircut_longs"], 0.03)


def test_portfolio_offsets_reduce_margin():
    """Ce que gagne un market maker : la marge de portefeuille reconnaît spreads et delta hedge."""
    cfg = ScanConfig(psr=0.15, ext_mult=2.0, ext_weight=1.0, short_min=0.05, adv=50_000)
    S, sig = 100.0, 0.35
    k110, k120 = Series("C", 110, 21 / 252), Series("C", 120, 21 / 252, funded=True)
    k120_pro = Series("C", 120, 21 / 252)
    naked = account_risk(Account(cash=0, positions={k110: -1_000}), S, sig, cfg)
    delta = 0.25   # couverture partielle en tokens
    hedged = account_risk(Account(cash=0, tokens=1_000 * delta, positions={k110: -1_000}), S, sig, cfg)
    spread = account_risk(Account(cash=0, positions={k110: -1_000, k120: 1_000}), S, sig, cfg)
    spread_pro = account_risk(Account(cash=0, positions={k110: -1_000, k120_pro: 1_000}), S, sig, cfg)
    assert hedged["mm"] < naked["mm"] and spread["mm"] < spread_pro["mm"] < naked["mm"]
    # Jambe longue préfinancée : la perte de scénario est bornée par la largeur (10/lot).
    assert spread["scan"] <= 1_000 * 10 + 1e-6
    # Jambe longue émise sur marge : décote => plus de borne garantie.
    assert spread_pro["scan"] > 1_000 * 10
    print(f"  MM — nu: {naked['mm']:.0f} | delta-couvert 25%: {hedged['mm']:.0f} | "
          f"spread long préfinancé: {spread['mm']:.0f} | spread long sur marge: {spread_pro['mm']:.0f}")


def test_partial_liquidation_restores_im():
    cfg = ScanConfig(psr=0.15, ext_mult=2.0, adv=50_000)
    s = Series("C", 110, 15 / 252)
    acc = Account(cash=0, positions={s: -1_000})
    r0 = account_risk(acc, 108.0, 0.35, cfg)
    acc.cash = 1_000 * float(bs_call(108.0, 110, s.tau, 0.35)) + 0.9 * r0["mm"]   # sous la MM
    assert account_risk(acc, 108.0, 0.35, cfg)["liquidable"]
    f, after, paid = partial_takeover(acc, 108.0, 0.35, cfg, bonus=0.05)
    r1 = account_risk(after, 108.0, 0.35, cfg)
    assert 0 < f < 1 and r1["nlv"] >= r1["im"] - 1e-3
    print(f"  liquidation partielle : {f:.1%} des shorts repris, {paid:.0f} versés au repreneur")


def test_onchain_integer_matches_float():
    cfg = ScanConfig(psr=0.15, ext_mult=2.0, short_min=0.05, adv=1e18)   # sans add-on de liquidité
    S, sig = 100.0, 0.35
    a, b = Series("C", 110, 21 / 252), Series("C", 120, 21 / 252)
    ra = {sid: [to_units_down(x) if x > 0 else to_units_up(x) for x in risk_array(s, S, sig, cfg)]
          for sid, s in (("a", a), ("b", b))}
    # Arrondi conservateur : pour un short, on arrondit les gains du long vers le HAUT (perte du short).
    ra_short = {sid: [to_units_up(x) for x in risk_array(s, S, sig, cfg)] for sid, s in (("a", a), ("b", b))}
    mark = {"a": to_units_up(float(bs_call(S, 110, a.tau, sig))), "b": to_units_down(float(bs_call(S, 120, b.tau, sig)))}
    smin = {k: to_units_up(cfg.short_min * S) for k in mark}
    liq = {k: 0 for k in mark}
    _, req = onchain_requirement({"a": -1_000}, ra_short, mark, smin, liq)
    flt = account_risk(Account(cash=0, positions={a: -1_000}), S, sig, cfg)["mm"]
    assert req >= flt * 1e7 - 1 and req - flt * 1e7 <= 1_000 * 2, (req, flt * 1e7)


def test_oi_cap():
    # Réserve 500 000 USDx, déficit de queue 18,54/lot (RWA fin, U=20 %, maker actif) => OI max ≈ 26 968 lots.
    assert math.floor(max_open_interest(500_000, 18.54)) == 26_968


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
