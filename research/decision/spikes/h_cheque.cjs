// Spike (h): C1 Cheque — 3 pre-signed payments sharing ONE seq, different timebounds; payee fee-bumps
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(52), JSON.stringify(v));
(async () => {
  const payer = Keypair.random(), payee = Keypair.random();
  await Promise.all([fund(payer), fund(payee)]);
  const subFB = async tx => { const fb = TransactionBuilder.buildFeeBumpTransaction(payee, '2000', tx, NP); fb.sign(payee);
    try { return { ok: true, hash: (await server.submitTransaction(fb)).hash }; } catch (e) { return { ok: false, codes: e?.response?.data?.extras?.result_codes || e.message }; } };
  // ---- Variant A: plain consecutive seq (S+1)
  const now = Math.floor(Date.now() / 1000);
  const S0 = BigInt((await server.loadAccount(payer.publicKey())).sequence);
  const mk = (seqAcc, amt, minT, maxT, pre) => { const b = new TransactionBuilder(new Account(payer.publicKey(), seqAcc.toString()), { fee: '1000', networkPassphrase: NP, timebounds: { minTime: minT, maxTime: maxT } })
    .addOperation(Operation.payment({ destination: payee.publicKey(), asset: Asset.native(), amount: amt })); if (pre) pre(b); const t = b.build(); t.sign(payer); return t; };
  const early = mk(S0, '97', 0, now + 25), onTime = mk(S0, '100', now + 25, now + 3600), late = mk(S0, '102', now + 3600, 0);
  log('A onTime before window', await subFB(onTime));
  log('A late before window', await subFB(late));
  log('A early (payee fee-bump)', await subFB(early));
  log('A onTime after early cashed', await subFB(onTime));
  // ---- Variant B: payer activity kills plain cheque
  const S1 = BigInt((await server.loadAccount(payer.publicKey())).sequence);
  const ch2 = mk(S1, '50', 0, 0);
  log('B payer unrelated payment', await submit(payer.publicKey(), [Operation.payment({ destination: payee.publicKey(), asset: Asset.native(), amount: '1' })], [payer]));
  log('B plain cheque after payer activity', await subFB(ch2));
  // ---- Variant C: minSeqNum precondition -> survives payer activity, still mutually exclusive
  const S2 = BigInt((await server.loadAccount(payer.publicKey())).sequence);
  const far = S2 + 2n ** 32n - 1n; const n2 = Math.floor(Date.now() / 1000);
  const pre = b => b.setMinAccountSequence(S2.toString());
  const cE = mk(far, '97', 0, n2 + 3600, pre), cL = mk(far, '102', 0, 0, pre);
  log('C payer unrelated payment x2', [await submit(payer.publicKey(), [Operation.payment({ destination: payee.publicKey(), asset: Asset.native(), amount: '1' })], [payer]), await submit(payer.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [payer])].map(r => r.ok));
  log('C minSeqNum cheque after payer activity', await subFB(cE));
  log('C sibling after one cashed', await subFB(cL));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
