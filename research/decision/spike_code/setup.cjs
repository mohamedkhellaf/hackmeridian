const { S, server, fund, submit } = require('../common.cjs');
const { Keypair, Operation, Asset, AuthRequiredFlag, AuthRevocableFlag, AuthClawbackEnabledFlag } = S;
const fs = require('fs');
(async () => {
  const K = { I: Keypair.random(), U: Keypair.random(), W: Keypair.random(), H: Keypair.random(), H2: Keypair.random() };
  await Promise.all(Object.values(K).map(fund));
  const FUND = new Asset('FUND', K.I.publicKey()), USDX = new Asset('USDx', K.U.publicKey());
  const r = {};
  r.flags = await submit(K.I.publicKey(), [Operation.setOptions({ setFlags: AuthRequiredFlag | AuthRevocableFlag | AuthClawbackEnabledFlag })], [K.I]);
  for (const n of ['W', 'H', 'H2']) r['trust_' + n] = (await submit(K[n].publicKey(), [Operation.changeTrust({ asset: FUND }), Operation.changeTrust({ asset: USDX })], [K[n]])).ok;
  r.authFUND = await submit(K.I.publicKey(), ['W', 'H', 'H2'].map(n => Operation.setTrustLineFlags({ trustor: K[n].publicKey(), asset: FUND, flags: { authorized: true } })), [K.I]);
  r.issueFUND = await submit(K.I.publicKey(), [Operation.payment({ destination: K.W.publicKey(), asset: FUND, amount: '1000' }), Operation.payment({ destination: K.H.publicKey(), asset: FUND, amount: '1000' })], [K.I]);
  r.issueUSD = await submit(K.U.publicKey(), ['W', 'H', 'H2'].map(n => Operation.payment({ destination: K[n].publicKey(), asset: USDX, amount: '100000' })), [K.U]);
  fs.writeFileSync('keys.json', JSON.stringify(Object.fromEntries(Object.entries(K).map(([k, v]) => [k, { pub: v.publicKey(), sec: v.secret() }])), null, 1));
  console.log(JSON.stringify(r, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
