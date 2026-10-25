// Spike (l): Chairman's C1 variant — cheque seq account 2-of-2 (payer+supplier), op source = payer main; supplier fee-bumps
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(58), JSON.stringify(v));
const mkCheque = async (P, Q, faces) => {
  const CA = Keypair.random();
  await submit(P.publicKey(), [Operation.createAccount({ destination: CA.publicKey(), startingBalance: '3' })], [P]);
  const r = await submit(CA.publicKey(), [Operation.setOptions({ signer: { ed25519PublicKey: P.publicKey(), weight: 1 } }), Operation.setOptions({ signer: { ed25519PublicKey: Q.publicKey(), weight: 1 } }),
    Operation.setOptions({ masterWeight: 0, lowThreshold: 2, medThreshold: 2, highThreshold: 2 })], [CA]);
  const seq = (await server.loadAccount(CA.publicKey())).sequence;
  const txs = faces.map(([amt, minT, maxT]) => { const t = new TransactionBuilder(new Account(CA.publicKey(), seq), { fee: '1000', networkPassphrase: NP, timebounds: { minTime: minT, maxTime: maxT } })
    .addOperation(Operation.payment({ source: P.publicKey(), destination: Q.publicKey(), asset: Asset.native(), amount: amt })).build(); t.sign(P); return t; }); // payer signs at issue
  return { CA, txs, setup: r.ok };
};
const cash = async (Q, t) => { t.sign(Q); const fb = TransactionBuilder.buildFeeBumpTransaction(Q, '2000', t, NP); fb.sign(Q);
  try { return { ok: true, hash: (await server.submitTransaction(fb)).hash }; } catch (e) { return { ok: false, codes: e?.response?.data?.extras?.result_codes || e.message }; } };
(async () => {
  const P = Keypair.random(), Q = Keypair.random(); await Promise.all([fund(P), fund(Q)]);
  const now = Math.floor(Date.now() / 1000);
  // cheque 1: (1) + (2)
  const c1 = await mkCheque(P, Q, [['97', 0, now + 3600], ['100', now + 3600, 0], ['102', 0, 0]]);
  log('cheque1 setup (2-of-2, master 0)', c1.setup);
  log('(1) payer alone bumpSequence on cheque acct', await submit(c1.CA.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [P]));
  log('(1) payer alone accountMerge cheque acct', await submit(c1.CA.publicKey(), [Operation.accountMerge({ destination: P.publicKey() })], [P]));
  log('(2) supplier cashes face 1 (open window)', await cash(Q, c1.txs[0]));
  log('(2) sibling face 3 (open window) after', await cash(Q, c1.txs[2]));
  // cheque 2: (3) bounce — payer empties main account
  const c2 = await mkCheque(P, Q, [['500', 0, 0], ['501', 0, 0]]);
  const bal = (await server.loadAccount(P.publicKey())).balances.find(b => b.asset_type === 'native').balance;
  log('(3) payer drains main acct to ~min', await submit(P.publicKey(), [Operation.payment({ destination: Q.publicKey(), asset: Asset.native(), amount: (Number(bal) - 10).toFixed(7) })], [P]));
  const s0 = (await server.loadAccount(c2.CA.publicKey())).sequence;
  log('(3) supplier cashes face (payer empty)', await cash(Q, c2.txs[0]));
  const s1 = (await server.loadAccount(c2.CA.publicKey())).sequence;
  log('(3) cheque acct seq consumed by bounce?', [s0, s1, s0 !== s1]);
  log('(3) sibling after bounce', await cash(Q, c2.txs[1]));
  const ftx = await server.transactions().forAccount(c2.CA.publicKey()).includeFailed(true).order('desc').limit(1).call();
  log('(3) bounce visible on Horizon (successful=false)?', ftx.records.map(r => [r.hash.slice(0, 8), r.successful]));
  // cheque 3: (4) payer rotates main key (master weight 0, new signer K)
  await submit(Q.publicKey(), [Operation.payment({ destination: P.publicKey(), asset: Asset.native(), amount: '2000' })], [Q]);
  const c3 = await mkCheque(P, Q, [['50', 0, 0]]);
  const K = Keypair.random();
  log('(4) payer rotates main key: add K, master 0', await submit(P.publicKey(), [Operation.setOptions({ signer: { ed25519PublicKey: K.publicKey(), weight: 1 } }), Operation.setOptions({ masterWeight: 0 })], [P]));
  log('(4) supplier cashes face after rotation', await cash(Q, c3.txs[0]));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
