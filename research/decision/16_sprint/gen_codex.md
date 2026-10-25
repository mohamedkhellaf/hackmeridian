**My pick is Prova de Caixa: merchant acceptance based on what actually settles, with a visible market for missing liquidity.** It offers the best balance of merchant onboarding, Stellar-specific execution, and a memorable demo.

Two boundaries matter. The evidence establishes fraud, payment delays, and training needs; it does **not** establish that your business contacts want stablecoins. Also, nobody can guarantee an idea will have no AI-generated twin. Your defensible distinction is the actual family experience and business relationships, expressed in the product’s workflow.

The business roles below are proposed Lisbon pilot users, not claims about your existing contacts. All four MVPs use Stellar testnet without bridges; seeded assets and liquidity must be clearly labelled as demonstrations.

1. **Prova de Caixa — “Show a Lisbon merchant how much of a proposed payment will actually arrive as money they accept, then let liquidity providers compete to make it possible.”**

   **Specific user:** The owner of a small Lisbon wholesaler considering stablecoin payments from its business customers, but needing a predictable euro-denominated settlement asset.

   **Problem and evidence:** A convincing payment screen is insufficient evidence of payment. GNR explicitly advises sellers to verify their account rather than trust screenshots or SMS receipts. On Stellar, SDF warns that scammers issue assets resembling legitimate ones. Separately, Intrum reports that 60% of Portuguese companies delay suppliers because their own customers pay late. These support a concrete acceptance question: *what usable settlement did this sale produce?* [GNR warning](https://www.gnr.pt/MVC_GNR/Recortes/Details/31285), [SDF scam guidance](https://stellar.org/blog/foundation-news/how-to-protect-yourself-from-scammers), [Intrum’s 2026 findings](https://www.intrum.pt/empresas/sobre-a-intrum/sala-de-imprensa/noticias/epr-2026-atrasos-nos-pagamentos-sao-obstaculo-ao-crescimento-das-empresas-nacionais/).

   **Stellar mechanism:** The merchant pins an accepted asset’s **code and issuer**. A `PathPaymentStrictReceive` delivers the exact sale amount in that asset, bounded by the buyer’s `sendMax`. Native DEX offers supply conversion liquidity. When a route is insufficient, an acceptance board exposes the shortfall; a participating business or market maker can add a `ManageSellOffer`. The checkout marks the sale paid only after successful ledger settlement. Stellar identifies assets by code **and issuer**, and path payments require executable liquidity. [Asset identity](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets), [strict-receive fields](https://developers.stellar.org/docs/data/horizon/api-reference/resources/operations/object/path-payment-strict-receive).

   The unusual component is **turning rejected merchant demand into specific liquidity requests**: “€300 sale waiting; this pair lacks €120 of depth.” Those requests are indications of demand, not guaranteed orders.

   **Why less likely to be an AI default:** The family scam supplies the lesson that a familiar label proves little. The business group supplies the practical acceptance requirement. Lisbon supplies the initial merchant network. The product starts from a merchant refusing unusable settlement, rather than from a generic crypto checkout.

   **90-second demo:**  
   **0–20s:** A wholesaler has a €300 sale. The buyer displays “1,000 EUR” from an unrelated issuer. The merchant’s accepted settlement remains zero.  
   **20–45s:** Switch to the approved demonstration dollar asset. It is authentic within the demo, but available conversion depth cannot complete the sale.  
   **45–70s:** A second business sees the liquidity request and posts a funded offer.  
   **70–90s:** Execute the path payment; exactly 300 demonstration euro units arrive.

   **Memorable moment:** **A huge displayed balance cannot complete the sale; one new liquidity offer makes it settle.**

   **Ecosystem effect:** New merchant accounts, customer transactions, and demand-driven DEX offers. Measure successful merchant settlements and independently supplied depth, rather than token issuance counts.

   **Buildability risks:** Approximately 10–13 focused hours for one pair, three participant roles, seeded offers, and a ledger-confirmed acceptance screen. Handle stale quotes and insufficient depth. DEX conversion does not certify the incoming asset’s legitimacy; the guarantee concerns the specified output. Euro tokens also remain distinct from bank euros.

   **Biggest weakness:** An ordinary checkout restricted to an established euro asset already solves much of the problem. Your differentiator must be the **merchant demand → liquidity provision → completed sale** loop. Without it, this becomes a familiar payment app.

2. **Cotação Fechada — “Let two businesses exchange existing currency balances through an executable quote whose amounts, issuers, and recipients cannot be changed by a forwarded message.”**

   **Specific user:** A Lisbon business receiving dollar stablecoins and another business needing dollars, introduced through your existing business group.

   **Problem and evidence:** CGD describes supplier impersonation involving requests to replace payment details with a fraudulent IBAN. Lisbon also has substantial international commerce through tourism: its airport received 18.2 million arriving passengers in 2025. That supports the setting, but does not prove demand for business-to-business stablecoin exchange. [CGD invoice-fraud warning](https://www.cgd.pt/Ajuda/Seguranca/Pages/FraudeFatura.aspx?start=4), [Turismo de Portugal](https://travelbi.turismodeportugal.pt/en/tourism-in-portugal/tourism-outlook-2025/).

   **Stellar mechanism:** A quote contains one classic transaction with two `Payment` operations: business A delivers the agreed dollar asset; business B delivers the agreed euro asset. Both operations succeed together or neither does.

   The quoting business installs the transaction hash as a **pre-authorized transaction signer**. The accepting business signs its side. A channel account supplies transaction sequencing, and time bounds expire the quote. Alternative quotes can share the channel’s next sequence number so only one executes. Stellar supports atomic operations, transaction-hash signers, and separate transaction/operation sources. [Atomic transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions), [pre-authorization](https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig), [channel accounts](https://developers.stellar.org/docs/build/guides/transactions/channel-accounts).

   Compare each quote against an executable public DEX route. This gives the user a reason to use the private quote: better price, sufficient size, or a known commercial counterparty.

   **Why less likely to be an AI default:** The distinctive workflow is a currency quote passed through the same informal business relationships where impersonation happens. The original counterparty’s authorization travels with the executable terms. Initial business identity still requires an independently verified introduction.

   **90-second demo:**  
   **0–25s:** Two businesses quote for an exact exchange; show the public DEX alternative.  
   **25–50s:** A forwarded “updated quote” changes the euro recipient. Submit it: the original pre-authorization cannot authorize the modified transaction.  
   **50–75s:** Accept the original quote. Both currency balances change together.  
   **75–90s:** Try executing the competing quote using the consumed sequence number; it fails.

   **Memorable moment:** **“New account, same deal” fails; the original two-sided exchange succeeds atomically.**

   **Ecosystem effect:** Brings business currency inventory and repeat trading volume onto Stellar. Direct quotes add settlement volume; they add public DEX depth only when participants separately post public offers.

   **Buildability risks:** Approximately 11–14 hours for two currencies, two quotes, and one acceptance flow. Sequence management and signer cleanup are the difficult parts. Pre-authorization does **not** reserve funds: cancellation, changed balances, or expiry can prevent execution.

   **Biggest weakness:** This needs two businesses with complementary on-chain inventory. Without evidence that your contacts have—or want—that inventory, it is a well-built OTC exchange with a speculative acquisition story. Its uniqueness is moderate.

3. **Bairro em Alerta — “Run a five-minute Lisbon trading day in which one impersonation scam makes an entire network of small businesses miss payments.”**

   **Specific user:** A business association, accountant, or owner organizing fraud training for a small group of interconnected businesses.

   **Problem and evidence:** In Mastercard’s 2025 survey, 79% of Portuguese SME owners said they needed cybersecurity training. Intrum’s findings establish that late receipts propagate into late supplier payments. Together these support training that shows the commercial consequences of fraud across relationships, beyond whether an individual spots a suspicious message. [Mastercard survey](https://www.mastercard.com/news/europe/pt-pt/redacao/comunicados-de-imprensa/pt-pt/2025/maio/ecrc-pequenas-e-medias-empresas-vulneraveis/), [Intrum](https://www.intrum.pt/empresas/sobre-a-intrum/sala-de-imprensa/noticias/epr-2026-atrasos-nos-pagamentos-sao-obstaculo-ao-crescimento-das-empresas-nacionais/).

   **Stellar mechanism:** Each player controls an actual testnet business account. A fixed scenario creates real payment operations, DEX offers, and path payments. An impostor can present a counterfeit asset with the same code; another scenario substitutes a supplier’s destination. The game scores successful settlement to designated accounts by a deadline, using ledger results.

   Stellar supplies the actual financial state: asset identity, liquidity, and irreversible sandbox balance changes determine outcomes. Asset-code collisions are a documented protocol property. [Stellar asset documentation](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets).

   **Why less likely to be an AI default:** Use an anonymized version of your family’s actual scam sequence and the actual structure of your business group, with permission. The game’s central consequence is that the victim’s supplier cannot pay someone else. That authored scenario is your human contribution.

   **90-second demo:**  
   **0–20s:** Three businesses appear with incoming receipts and outgoing obligations.  
   **20–40s:** The presenter receives an urgent “supplier changed account” message and follows it. A real testnet payment reaches the impostor.  
   **40–60s:** Two legitimate businesses become unable to complete their scheduled payments.  
   **60–90s:** Switch to a separately seeded replay, verify the supplier through the established channel, and complete the legitimate payments.

   **Memorable moment:** **One person’s decision turns three businesses red.**

   **Ecosystem effect:** Introduces owners and staff to Stellar accounts and real protocol interactions. A later merchant pilot could convert training into adoption. Training accounts and rehearsal trades should not be presented as durable users or economic liquidity.

   **Buildability risks:** Approximately 8–12 hours for one scripted scenario, three roles, and two pre-seeded runs. The narrative and interface matter more than game breadth. Testnet losses have no monetary value, so this MVP does **not** substantiate the official “real onchain stakes” angle.

   **Biggest weakness:** Training could largely run in a conventional simulator. Using actual Stellar operations is compelling for Stellar merchant onboarding, but less essential for general MB Way fraud education. It has the strongest human story and the weakest immediate liquidity effect.

4. **Pode Circular? — “Before a business group adopts a settlement asset, show exactly which members can receive, trade, and use it—and demonstrate where the network breaks.”**

   **Specific user:** The accountant or technical integrator helping your connected businesses trial Stellar settlement.

   **Problem and evidence:** Trust in a supplier does not establish technical readiness. Sage’s research found that 56% of Portuguese SMB respondents were uncertain whether their suppliers operated securely. On Stellar, receiving and trading also depend on issuer-specific trustlines, authorization, balances, and available liquidity. [Sage SMB cybersecurity research](https://www.sage.com/en-gb/-/media/files/sagedotcom/master/documents/pdf/sage-smbs-cyber-security-report-gb.pdf), [Stellar asset controls](https://developers.stellar.org/docs/tokens/control-asset-access).

   **Stellar mechanism:** Build a small compatibility graph for specified business accounts, assets, and transaction amounts. Inspect trustlines and authorization; query conversion paths; distinguish missing permission from missing liquidity.

   A controlled testnet issuer demonstrates `AUTH_REQUIRED`, `AUTH_REVOCABLE`, and `SetTrustLineFlags`. In particular, **authorization to maintain liabilities preserves existing offers but does not permit normal transfers or trading**. The tool explains why a visible offer may not imply usable settlement. Only a controlled issuer can perform the demo’s authorization changes. [Authorization semantics](https://developers.stellar.org/docs/tokens/control-asset-access), [path-payment requirements](https://developers.stellar.org/docs/build/guides/transactions/path-payments).

   **Why less likely to be an AI default:** It turns your real business network into the onboarding unit. The family scam contributes skepticism about apparent identity; the group contributes actual counterparties; the Lisbon pilot supplies a bounded deployment. Its output is a concrete list of broken settlement relationships and required fixes.

   **90-second demo:**  
   **0–25s:** Three businesses show balances in the same demonstration asset. The group appears ready.  
   **25–50s:** Run the checks: one cannot receive; another has a visible offer but insufficient authorization to trade. Attempt the affected transactions and show the ledger failures.  
   **50–75s:** The controlled issuer authorizes the relevant trustlines.  
   **75–90s:** Repeat the transactions successfully.

   **Memorable moment:** **“All three have the token” becomes “only one can currently use it.”**

   **Ecosystem effect:** Helps merchant groups and issuers activate usable trustlines and trading relationships. It can identify where market makers should add liquidity. Its effect is enabling adoption rather than directly generating recurring volume.

   **Buildability risks:** Approximately 9–12 hours for three accounts, two assets, and four failure explanations. Keep the scope to classic assets. Results are a current-state assessment, not a promise that liquidity or permissions will remain unchanged.

   **Biggest weakness:** This is a specialized integration tool. The technical failure modes are verified; willingness to pay for the checker is unverified. It risks looking like an explorer feature unless a real business group demonstrates why existing interfaces failed them.

**Build Prova de Caixa.** It has the clearest route from your human seeds to new merchants and useful DEX liquidity. The memorable claim is narrow and demonstrable: **a customer’s balance is not enough; the merchant needs executable settlement.**

For the 15-hour build, assign one developer to assets/offers/path-payment execution, one to merchant and liquidity-provider screens, and one to customer validation, failure cases, and the submission. Aim to finish the complete ledger-backed flow by hour 10 and protect the remaining time for the video and documentation.

The most valuable validation is one conversation with your existing business contact: establish what would make them accept a new settlement method and whether a customer has ever proposed one. Report the actual answer—even if skeptical. A credible objection from a real merchant strengthens the submission more than an invented adoption claim.

Target **Stellar Unlocked**. Multiple core features alone do not establish **Stellar Composed** eligibility. Keep the pitch centered on the working merchant-liquidity loop, and label every demonstration asset, funded offer, and hypothetical business role honestly.