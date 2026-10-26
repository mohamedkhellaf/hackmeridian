# Strata Pro — architecture de compensation pour calls non couverts

Version du 25 octobre 2026. Conception pour Testnet. Les modèles et les tests sont dans `packages/risk/` (`strata_risk.py`, `test_strata_risk.py`).

> **Périmètre v0 :** ce document décrit la cible. Ce qui est construit pour la soumission est défini par `docs/pro-v0-brief-dev2.md` et `packages/risk/pro_v0_model.py`. Pas en v0 : TWAP de règlement, enchère hollandaise, liquidation partielle, fonds de défaut des makers, tokens en couverture, MMP. Aucun paramètre n'est validé pour des fonds réels. **v0.3.2 (26 octobre)** intègre les revues 1 à 4 de Dev 2 sur la PR #30 (voir le §0 du brief) ; on-chain : no-go pour le hackathon, Pro est livré comme spec + modèle + simulateur. Sous-jacent démo : le label fictif `EQTY`, avec la calibration « action liquide » ; les RWA fins restent en Covered (§5).

## 0. Décision

Strata Pro n'est pas « un contrat d'options avec une formule de marge ». C'est une **mini-chambre de compensation** construite sur cinq pièces :

1. **Comptes de marge croisée par sous-jacent.** La marge est calculée par scénarios, sur un modèle SPAN à 16 scénarios.
2. **Publieur de risque hors chaîne.** Il signe des *risk arrays* par série. Le contrat ne fait que de l'algèbre entière : aucun Black–Scholes on-chain.
3. **Vault de backstop financé par des LP.** C'est le « Charlie » qui existe toujours, dans la limite de son capital. Il reprend les positions liquidées et porte la première perte contre rémunération.
4. **Waterfall de défaut explicite.** Marge du défaillant, puis sa contribution, puis le backstop, puis le fonds mutualisé, puis une réduction pro rata des créances longues.
5. **Plafonds d'open interest dérivés du capital de défaut.** Ce ne sont pas des choix commerciaux.

Les calls Pro sont américains et réglés en cash : exerçables avant l'échéance au spot d'un snapshot de moins de 120 s, contre un vendeur sain ; un book repris par le vault, un vendeur liquidable ou une dette échue non cotée renvoient au règlement à l'échéance (brief §1). Le règlement physique reste réservé au régime Covered.

## 1. Les vrais problèmes, par ordre de gravité

| # | Problème | Pourquoi c'est grave sur Stellar et les RWA | Levier |
|---|---|---|---|
| 1 | **Saut de prix hors séance** | Le token circule 24/7, mais le marché de référence ferme. Le prix est figé tout le week-end, puis saute à l'ouverture. Aucune liquidation n'est possible pendant le saut. | Scénarios extrêmes à plein poids, plancher par short, add-on avant les fermetures, plafonds d'OI |
| 2 | **Absence de repreneur** | Une liquidation suppose une contrepartie. Sur un token fin, il n'y en a pas spontanément. | Vault de backstop pré-engagé, capacité publiée, enchère hollandaise sur le bonus |
| 3 | **Corrélation parfaite des makers** | Tous les makers sont courts de calls sur le même sous-jacent. Le défaut est simultané, pas indépendant. | Réserve dimensionnée sur la queue du livre agrégé (§6), pas par position |
| 4 | **Sélection adverse sur les cotations** | L'oracle retarde : Alice achète le call juste avant que l'information arrive. Le maker se fait « picker ». | Cotations liées à une séquence d'oracle, bande de prix, MMP (§8) |
| 5 | **Oracle et règlement** | Un prix manipulé peut liquider à tort ou régler faux. | Bornes d'arbitrage on-chain, séparation des rôles, TWAP de règlement, délai de repli |
| 6 | **Pro-cyclicité** | Les marges montent dans le stress, ce qui force des ventes en chaîne. | Plancher de volatilité longue, hystérésis IM = 1,25 × MM, scan range figé par époque |
| 7 | **Qualité de crédit non fongible** | Un call Pro n'est pas équivalent à un call Covered de mêmes termes. | Régime de garantie inclus dans le `series_id` ; décote des longs Pro (§3.3) |

## 2. Composants

```
                ┌────────────────────┐   risk arrays signés / époque
  Oracle ──────▶│ Risk Publisher      │──────────────────────┐
 (prix, séq.)   │ (hors chaîne, Py)   │                      ▼
                └────────────────────┘          ┌──────────────────────────┐
  Makers ──── dépôts, quotes, fills, top-up ───▶│  strata_pro (Soroban)     │
  Alice  ──── achat, claim ────────────────────▶│  comptes, positions,      │
  Keepers ─── flag / liquidate (sans permis) ──▶│  marge entière, waterfall │
                                                 └───────┬──────────┬──────┘
                                      reprise/1re perte  │          │ contributions
                                                 ┌───────▼──┐  ┌────▼─────────┐
                                                 │ Backstop │  │ Default Fund │
                                                 │ Vault LP │  │ (makers)     │
                                                 └──────────┘  └──────────────┘
  contracts/options (régime Covered, physique) : contrat séparé, aucun flux partagé.
```

- **strata_pro**: un contrat. Vault, backstop et fonds de défaut y sont des compartiments comptables séparés. Un seul contrat, c'est moins d'appels inter-contrats et des invariants vérifiables en un endroit.
- **Risk Publisher**: le script Python de ce repo, devenu service. Il publie `(series_id, epoch, oracle_seq, spot, mark, risk_array[16], short_min, liq_per_lot, expiry_ts)`, le tout signé.
- **Keeper**: un bot permissionless qui appelle `liquidate`. N'importe qui peut le faire tourner, il n'a besoin d'aucune clé privilégiée.
- **Oracle**: Reflector, si le sous-jacent y est couvert (à vérifier), sinon un feed démo signé et étiqueté comme tel.

## 3. Modèle de marge

### 3.1 Définitions

Pour un compte et un sous-jacent :

- **NLV** = cash + tokens·S·(1−h_tok) + Σ longs·mark·(1−h_long) − Σ shorts·mark
- **Scan** = max(0, −min_ω Σ_i q_i · RA_i[ω]). RA_i[ω] est le P&L pondéré d'un lot long de la série i dans le scénario ω. Les tokens détenus ajoutent leur P&L S·u.
- **MM** = max(Scan, Σ_shorts q·s_min·S) + L_liq, avec L_liq = y·σ_jour·S·|Δ_net|·√(|Δ_net| / ADV), la loi d'impact en racine carrée.
- **IM** = 1,25 × MM.
- **Règles** : on ouvre ou on retire seulement si NLV_après ≥ IM. Le compte est liquidable si NLV < MM.

### 3.2 Scénarios (16)

- Prix ∈ {0, ±⅓U, ±⅔U, ±U} × vol ∈ {×1,25 ; ×0,75}.
- Deux extrêmes à ±m·U.
- **Différence clé avec SPAN** : SPAN pondère les extrêmes à 35 %. Strata les pondère à 100 %, car le risque d'un short call est précisément dans la queue (§5).
- U = max(plancher, z·σ_eff·√(H/252)) + add-on de saut, avec σ_eff = max(σ_courte, σ_longue, σ_plancher).
- H = détection + inclusion + sortie + plus longue fermeture du marché de référence.

### 3.3 Ce que gagne un market maker

Exemple : 1 000 calls K=110, S=100, 21 jours, σ=35 %, U=15 %. Résultats du test `test_portfolio_offsets_reduce_margin`.

| Livre | MM | Capital / notionnel |
|---|---|---|
| Covered call (régime existant) | 100 000 en tokens | 100 % |
| 1 000 calls nus | 19 291 | 19 % (IM 24 %) |
| Calls nus + 250 tokens en delta-hedge | 11 771 | 12 % de marge, plus 25 % en tokens qui portent du P&L |
| Spread 110/120, jambe longue **préfinancée** | 7 902 | 8 %, borné par la largeur |
| Spread 110/120, jambe longue **émise sur marge** | 13 593 | 14 % : la jambe longue est décotée de 50 % |

La dernière ligne est la règle la plus importante pour éviter les faux gains de diversification : **un long n'est une couverture que si son vendeur paiera**. Les longs Covered et Defined Risk reçoivent un crédit plein. Les longs Pro reçoivent un crédit décoté.

### 3.4 Calcul on-chain

Le contrat ne connaît ni exp, ni log, ni volatilité. Pour chaque série, il stocke le dernier snapshot signé en entiers i128 à 7 décimales et calcule :

```
pnl[ω] = Σ_i q_i · RA_i[ω]          (16 × nb_séries multiplications entières)
scan   = max(0, −min_ω pnl[ω])
mm     = max(scan, Σ_shorts q·smin) + Σ_shorts q·liq_per_lot
```

Les arrondis sont conservateurs : exigences arrondies vers le haut, NLV vers le bas. Plafonner à 8 séries par compte et par sous-jacent borne le CPU. Le test `test_onchain_integer_matches_float` vérifie que l'entier est supérieur ou égal au flottant.

**Hypothèse de confiance affichée** : le publieur peut mentir sur les risk arrays. Le contrat le borne :
- mark ∈ [intrinsèque, S] pour un call ;
- snapshot plus récent que `max_age` ;
- `oracle_seq` monotone ;
- variation de U d'une époque à l'autre limitée à ±50 % ;
- rôle de publieur distinct de tout maker.

## 4. Calibration : ce que disent les simulations

Le simulateur (`simulate`) utilise :
- une diffusion avec sauts de Merton ;
- 7 contrôles par séance, avec une variance de nuit (30 % de la variance quotidienne) et des sauts concentrés hors séance, triplés le week-end ;
- une liquidation exécutée `lag` heures après détection, au mark + 5 %, avec un coût de sortie multiplié par 2 ou 3 sous stress.

Un call vendu à 10 % hors de la monnaie, sur 21 jours, 30 000 trajectoires. Deux comportements de maker sont simulés :

- **passif** : ne recharge jamais et retire tout excédent ;
- **actif** : recharge à l'IM à chaque contrôle et ne fait défaut que lorsqu'un saut le fait passer sous la MM en un seul pas. C'est le cas pertinent pour la queue.

**Maker actif** (cas dimensionnant). Les montants sont par lot ; la prime vaut 0,98 sur l'action liquide et 3,31 sur le RWA.

| Marché | Marge | IM / notionnel | P(déficit) | Perte attendue / lot | q99,9 / lot |
|---|---|---|---|---|---|
| Action liquide (σ 35 %, 4 sauts/an σ_J 8 %, lag 1 h) | Fixe FINRA 20 %/10 % | 12,5 % | 0,10 % | 0,004 | 0,34 |
| | SPAN classique U=10 %, extrêmes à 35 % | 8,5 % | **0,96 %** | 0,040 | **8,97** |
| | **Strata U=15 %, extrêmes ×2 à 100 %** | 24,1 % | 0,01 % | 0,0005 | 0,00 |
| | Strata U=20 %, plancher 10 % | 36,3 % | 0,00 % | 0 | 0 |
| RWA fin (σ 60 %, 10 sauts/an σ_J 15 %, lag 3 h, ADV 10k) | Fixe FINRA 20 %/10 % | 12,5 % | 2,00 % | 0,166 | 23,7 |
| | SPAN classique U=10 % | 8,4 % | **4,07 %** | 0,365 | 30,1 |
| | Strata U=15 % | 23,4 % | 2,12 % | 0,196 | 25,9 |
| | **Strata U=20 %, plancher 10 %** | 34,6 % | 0,94 % | 0,080 | 18,5 |
| | Strata U=30 %, plancher 10 % | 58,8 % | 0,09 % | 0,006 | 0,00 |

Ce que cela tranche :

1. **Sous-pondérer la queue est la pire option.** Le SPAN classique demande le moins de capital, mais présente 10 à 40 fois plus de risque de déficit sur l'action liquide (2 à 4 fois sur le RWA fin, mesure de Dev 2, revue 4). Pour un short call, la queue *est* le risque.
2. **Action liquide** : environ 15 à 24 % du notionnel suffit à rendre le déficit négligeable dans ce modèle. Pro y est **4 à 6 fois plus efficace** qu'un covered call. Le marché est éligible.
3. **RWA fin** : aucune marge sous environ 35 % du notionnel ne descend sous 1 % de probabilité de déficit. À 59 %, le gain sur un covered call n'est que de 1,7 fois, et il faut encore payer la réserve (§6.3). **Les RWA fins restent en Covered ou Defined Risk.** C'est la justification chiffrée de la séparation des régimes.
4. Le maker passif (non montré ; `python strata_risk.py 30000`) fait *moins* de déficits, car il est liquidé dès les premières variations, dans la grande majorité des trajectoires (98,9 à 99,4 % avec les marges Strata, 84,5 % avec la seule marge FINRA ; mesures de Dev 2, revue 4 de la PR #30). Une marge qui « marche » parce qu'elle liquide tout le monde n'est pas viable pour un maker. L'hystérésis IM/MM et la liquidation partielle sont là pour ça.

Reproduire : `python strata_risk.py 30000` (environ 5 min).

## 5. Contrôler le risque d'un call nu : les leviers, dans l'ordre

1. **Plancher par short** (`short_min`). Pour un call loin de la monnaie, le scan est minuscule alors que le saut est mortel. Le plancher fait payer chaque short. FINRA l'applique à 10 % du spot.
2. **Scénarios extrêmes à plein poids.** La pondération SPAN à 35 % produit le pire résultat des simulations (§4).
3. **Add-on de fermeture.** Avant chaque fermeture du marché de référence (soir, week-end, résultats), U est augmenté pour couvrir le gap de réouverture. Il est publié à l'avance, pour que les makers rechargent avant la fermeture et non pendant.
4. **Plafonds d'OI calculés** : OI_max = capital de défaut / déficit de queue par lot (§6). C'est le seul levier qui protège contre la corrélation parfaite.
5. **Plafond par maker** : la plus grande exposition d'un maker ne doit pas dépasser la capacité de reprise du backstop (logique « Cover-1 » des CCP).
6. **Liquidation partielle et précoce.** Le compte est réduit juste ce qu'il faut pour revenir à l'IM ; dans le test, 28 % des shorts sont repris. Cela réduit la taille des transferts, donc l'impact.
7. **Reconnaissance des couvertures réelles.** Tokens en dépôt et longs préfinancés réduisent la marge (§3.3). Le maker est payé pour se couvrir, ce qui réduit le risque systémique.
8. **Interdiction près de l'échéance.** Plus de nouvelles ventes Pro dans les dernières 24 heures de séance. U croît quand τ → 0 (gamma).
9. **Règlement au TWAP** sur la dernière heure de séance. Cela réduit la manipulation et l'effet d'un dernier tick.
10. **Mode réduction seule** sur alerte oracle ou sur une profondeur sous seuil. Le top-up, la clôture et les claims restent ouverts.

## 6. Défaut, réserve et plafonds

### 6.1 Waterfall (`default_waterfall`)

1. Marge du défaillant
2. Contribution du défaillant au fonds de défaut (exigée à l'admission, non comptée dans sa marge)
3. Première perte du backstop vault (tranche junior des LP)
4. Fonds mutualisé des autres makers
5. Réduction pro rata des créances longues. Alice est informée dès l'achat que c'est la couche finale.

La réserve inutilisée n'est jamais distribuée pendant que des positions vivent.

### 6.2 Dimensionner la réserve

Le livre est corrélé à 100 % : le déficit agrégé croît linéairement avec l'OI. Donc :

```
Capital_défaut ≥ OI × q99.9(déficit par lot)      →      OI_max = Capital_défaut / q99.9
```

Exemple, avec la valeur de q99.9 de l'actif RWA fin sous scan U=20 % et un maker actif (§4), soit 18,5 par lot : 500 000 USDx de capital de défaut permettent un OI d'environ 27 000 lots.

### 6.3 Qui paie la réserve

Les LP du backstop doivent être rémunérés au-dessus de leur perte attendue :

```
frais de réserve par lot ≥ EL par lot + coût du capital × (q99.9 par lot) × durée
```

Avec EL ≈ 0,08 par lot, q99.9 ≈ 18,5 par lot, un coût du capital de 15 %/an et 21 jours, on obtient ≈ 0,08 + 0,23 = **0,31 par lot**. C'est environ **9 % de la prime** (3,31). Ce chiffre est la réalité économique d'un call nu sur un actif fin : il faut le facturer, pas le cacher. Sur l'action liquide, l'EL est négligeable et le coût est dominé par le capital.

Sources de financement : frais de réserve sur chaque fill Pro, bonus de liquidation perçus par le vault, contributions des makers.

## 7. Liquidation

1. **Déclenchement permissionless** : `flag(account)` est valide si NLV < MM avec un snapshot frais. Le simple signalement n'est jamais payé, pour éviter le griefing.
2. **Enchère hollandaise sur le bonus.** Le bonus monte de 0 à `max_bonus` (10 %) sur N minutes. Le premier repreneur qui dépose son IM prend la fraction minimale f qui ramène le compte à l'IM.
3. **Backstop obligatoire.** Si personne n'a pris à `max_bonus`, le vault reprend, dans la limite de sa capacité. C'est l'engagement contractuel des LP, qui en sont rémunérés.
4. **Aucune reprise possible** (vault saturé) : mode réduction seule sur ce sous-jacent. La position reste due et le compte est en défaut à l'échéance, avec application de la waterfall.
5. **Anti-collusion** : X par lot = mark·(1+bonus). Le mark est borné on-chain et le bonus plafonné (`takeover_price`). Le contrat ne rejette un snapshot que s'il est incohérent avec le spot qu'il annonce : un spot gonflé mais cohérent passe (brief §5).

Pour Alice, la position ne change pas pendant une reprise : même série, même quantité, même droit au règlement. Si le vault reprend, le paiement de son ancien vendeur reste réservé à son book (v0.3) ; seul le reste dû est mutualisé avec les autres insuffisances de la série.

## 8. Viabilité pour les market makers

- **Marge croisée** par sous-jacent, couvertures reconnues, retrait de l'excédent au-dessus de l'IM.
- **Cotations protégées** : chaque quote porte `ref_oracle_seq` et `max_deviation`. Elle est rejetée au fill si le prix a bougé au-delà.
- **MMP (market maker protection)**, comme sur Deribit : au-delà de X lots exécutés en Y secondes, les quotes du maker s'annulent. `cancel_all` incrémente l'époque de nonce.
- **Aperçu de marge marginale** : la fonction de vue `what_if(account, fill)` renvoie MM et IM après le fill.
- **Coûts explicites** : frais de réserve, bonus de liquidation et contribution au fonds de défaut sont publiés par marché.

Tableau de comparaison pour un maker sur l'action liquide : un covered call immobilise 100 % du notionnel, alors qu'un livre Pro couvert en delta immobilise 12 à 24 % en marge, hors tokens de couverture (environ 25 % du notionnel en plus). C'est l'argument commercial, et il n'est vrai que sur les marchés admis.

## 9. Invariants (tests de propriétés côté contrat)

1. Pour chaque token : balance du contrat ≥ libres + marges + compartiment backstop + fonds de défaut + claims dus.
2. Aucune opération utilisateur ne laisse un compte avec NLV < IM, sauf top-up, réduction, claim et liquidation.
3. Une liquidation réduit strictement l'exigence du compte ou ne s'exécute pas.
4. Une reprise ne modifie aucune position longue ; une reprise par le vault réserve le paiement du vendeur au book repris.
5. Σ allocations du backstop ≤ capital du backstop. Le fonds de défaut n'est jamais compté dans la marge d'un maker.
6. Un règlement s'exécute une seule fois par position. Le prix final est immuable.
7. Les pertes Pro ne touchent jamais `contracts/options`.
8. Arithmétique i128 vérifiée. Les arrondis vont toujours contre le compte qui porte le risque.

## 10. ABI minimale

```
// admin / rôles (multisig hors démo)
init(admin, publisher, quote_token, params)
list_market(underlying, config)            config: U_floor, short_min, im_mult, max_oi, max_maker_oi, max_age...
publish_risk(series_id, snapshot, sig)     // rôle publisher

// makers
deposit(acct, token, amount) / withdraw(acct, token, amount)      // withdraw: NLV_après ≥ IM
create_quote(acct, series_id, qty, premium, ref_oracle_seq, max_dev, expiry, nonce_epoch)
cancel_all(acct)                                                   // ++nonce_epoch
fill(taker, quote_id, qty)                                         // prime → marge du maker
top_up(acct, amount)

// risque
flag(acct) -> bool
liquidate(liquidator, acct, max_fraction, liquidator_deposit)     // enchère hollandaise sur le bonus
backstop_take(acct)                                                // si personne à max_bonus

// échéance
publish_settlement(series_id, twap, sig)  // une fois, dans la fenêtre
settle(position_id) / claim(holder)

// vues
get_account(acct) -> {nlv, mm, im, positions}
what_if(acct, series_id, qty) -> {mm, im}
```

Côté Soroban :
- risk arrays en stockage `persistent` avec TTL étendu à chaque publication ;
- comptes en `persistent` ;
- paramètres en `instance` ;
- `require_auth` sur tout débit ;
- USDx et tokens via SAC.

## 11. Plan 24 h (UI hors périmètre) — remplacé

> Plan d'origine, conservé pour mémoire. Remplacé par la décision no-go on-chain du 26 octobre (brief §0). L'ABI réelle est celle du brief §6, pas celle du §10 ci-dessus.

| Créneau (Lisbonne) | Dev1 : quant | Dev2 : contrat | Dev3 : infra |
|---|---|---|---|
| → 01 h | Figer les paramètres de 2 marchés et les fixtures (`test_strata_risk.py`) | Stockage, dépôts, comptes, `publish_risk` + bornes | Service publieur : script → snapshot signé → Testnet |
| 01 → 04 h | Calibration finale, `what_if`, script de scénarios | `fill`, marge entière, `withdraw`, `top_up` | Keeper : `flag` / `liquidate` en boucle |
| **04 h : arrêt/go** | fill → saut → flag → reprise vérifiés sur Testnet ? | sinon : couper l'enchère, garder la reprise backstop seule | |
| 04 → 07 h | Rapport de calibration | Waterfall, `settle`, `claim`, invariants | Scénario rejoué de bout en bout (normal, reprise, gap avec déficit) |
| **07 h : gel** | | Corrections bloquantes uniquement | Transactions de preuve, identifiants des contrats |
| 07 → 11 h | README quant, limites, vidéo | Revue de sécurité | Livraison des scripts, soumission |

À couper si le planning dérape, dans cet ordre : MMP, enchère hollandaise (bonus fixe), liquidation partielle (reprise totale), marge croisée multi-séries (une série par compte).

## 12. Ce que le modèle ne capture pas

- Volatilité constante entre deux contrôles : pas de saut de volatilité joint au saut de prix, ce qui sous-estime le coût de reprise.
- Marché de référence simulé, sans corrélation avec la liquidité du token Stellar.
- Le simulateur suppose que le repreneur existe toujours au mark + bonus. Seule la capacité du vault rend cela vrai, et seulement jusqu'à cette capacité.
- Aucune calibration sur données réelles. Les deux marchés sont des hypothèses illustratives.
