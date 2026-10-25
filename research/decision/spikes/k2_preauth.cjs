// Spike (k): Judge's C1 fix — cheque account locked to 3 pre-auth face hashes (master 0); payer signs op
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(56), JSON.stringify(v));
(async () => {
  const P = Keypair.random(), Q = Keypair.random(), CA = Keypair.random(); await Promise.all([fund(P), fund(Q)]);
  log('P creates cheque account CA (5 XLM)', await submit(P.publicKey(), [Operation.createAccount({ destination: CA.publicKey(), startingBalance: '5' })], [P]));
  const caSeq = (await server.loadAccount(CA.publicKey())).sequence; // S
  const now = Math.floor(Date.now() / 1000);
  // faces at CA seq S+2 (setup tx below consumes S+1)
  const face = (amt, minT, maxT) => { const t = new TransactionBuilder(new Account(CA.publicKey(), (BigInt(caSeq) + 1n).toString()), { fee: '1000', networkPassphrase: NP, timebounds: { minTime: minT, maxTime: maxT } })
    .addOperation(Operation.payment({ source: P.publicKey(), destination: Q.publicKey(), asset: Asset.native(), amount: amt })).build(); t.sign(P); return t; };
  const early = face('97', 0, now + 3600), onTime = face('100', now + 3600, now + 7200), late = face('9000000', 0, 0);
  log('lock CA: 3 preAuth signers, master 0, thresholds 1', await submit(CA.publicKey(), [
    ...[early, onTime, late].map(t => Operation.setOptions({ signer: { preAuthTx: t.hash(), weight: 1 } })),
    Operation.setOptions({ masterWeight: 0, lowThreshold: 1, medThreshold: 1, highThreshold: 1 })], [CA]));
  log('(a) CA master key tries bumpSequence', await submit(CA.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [CA]));
  log('(a) P tries bumpSequence on CA (P not a signer)', await submit(CA.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [P]));
  const sub = async t => { const fb = TransactionBuilder.buildFeeBumpTransaction(Q, '2000', t, NP); fb.sign(Q);
    try { return { ok: true, hash: (await server.submitTransaction(fb)).hash }; } catch (e) { return { ok: false, codes: e?.response?.data?.extras?.result_codes || e.message }; } };
  // (c) submit the 'late' face first: amount exceeds P balance -> does it land as failed?
  log('(b) early face cashed (success path)', await sub(early));
  const ca2 = await server.loadAccount(CA.publicKey());
  log('(b) CA seq after / signers left', [ca2.sequence, ca2.signers.map(s => s.type + ':' + s.weight)]);
  log('(b) late sibling after success', await sub(late));
  // (b) clean run: new cheque, cash early, check signer removal + siblings
})().catch(e => { console.error('FATAL', e); process.exit(1); });
