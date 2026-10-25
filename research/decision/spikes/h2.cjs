const { S, server, NP, fund } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(52), JSON.stringify(v));
(async () => {
  const payer = Keypair.random(), payee = Keypair.random(); await Promise.all([fund(payer), fund(payee)]);
  const subFB = async tx => { const fb = TransactionBuilder.buildFeeBumpTransaction(payee, '2000', tx, NP); fb.sign(payee);
    try { return { ok: true, hash: (await server.submitTransaction(fb)).hash }; } catch (e) { return { ok: false, codes: e?.response?.data?.extras?.result_codes || e.message }; } };
  const now = Math.floor(Date.now() / 1000), S0 = (await server.loadAccount(payer.publicKey())).sequence;
  const mk = (amt, minT, maxT) => { const t = new TransactionBuilder(new Account(payer.publicKey(), S0), { fee: '1000', networkPassphrase: NP, timebounds: { minTime: minT, maxTime: maxT } })
    .addOperation(Operation.payment({ destination: payee.publicKey(), asset: Asset.native(), amount: amt })).build(); t.sign(payer); return t; };
  const early = mk('97', 0, now + 12), onTime = mk('100', now + 12, now + 3600), late = mk('102', now + 3600, 0);
  log('early after its window closes? (wait 15s)', (await sleep(15), await subFB(early)));
  log('onTime inside its window (payee fee-bump)', await subFB(onTime));
  log('early again (after onTime cashed)', await subFB(early));
  log('late (before window, after onTime cashed)', await subFB(late));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
