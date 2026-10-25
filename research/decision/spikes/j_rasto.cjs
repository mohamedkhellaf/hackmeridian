// Spike (j): C4 RASTO / C3 — issuer freeze + clawback across mule hops + restitution, one atomic tx
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, AuthRequiredFlag, AuthRevocableFlag, AuthClawbackEnabledFlag } = S;
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(50), JSON.stringify(v));
(async () => {
  const iss = Keypair.random(), mum = Keypair.random(), m1 = Keypair.random(), m2 = Keypair.random(), m3 = Keypair.random();
  await Promise.all([iss, mum, m1, m2, m3].map(fund));
  const EUR = new Asset('EURT', iss.publicKey());
  log('issuer flags REQ|REV|CLAWBACK', await submit(iss.publicKey(), [Operation.setOptions({ setFlags: AuthRequiredFlag | AuthRevocableFlag | AuthClawbackEnabledFlag })], [iss]));
  for (const k of [mum, m1, m2, m3]) await submit(k.publicKey(), [Operation.changeTrust({ asset: EUR })], [k]);
  log('authorize 4 + issue 900 to mum', await submit(iss.publicKey(), [...[mum, m1, m2, m3].map(k => Operation.setTrustLineFlags({ trustor: k.publicKey(), asset: EUR, flags: { authorized: true } })),
    Operation.payment({ destination: mum.publicKey(), asset: EUR, amount: '900' })], [iss]));
  log('scam: mum->m1 900', await submit(mum.publicKey(), [Operation.payment({ destination: m1.publicKey(), asset: EUR, amount: '900' })], [mum]));
  log('fan-out m1->m2 400, m1->m3 400', await submit(m1.publicKey(), [Operation.payment({ destination: m2.publicKey(), asset: EUR, amount: '400' }), Operation.payment({ destination: m3.publicKey(), asset: EUR, amount: '400' })], [m1]));
  log('m3 posts DEX offer (escape attempt) sell 100 EURT for XLM', await submit(m3.publicKey(), [Operation.manageSellOffer({ selling: EUR, buying: Asset.native(), amount: '100', price: '10' })], [m3]));
  const ops = [];
  for (const k of [m1, m2, m3]) ops.push(Operation.setTrustLineFlags({ trustor: k.publicKey(), asset: EUR, flags: { authorized: false } }));
  ops.push(Operation.clawback({ asset: EUR, from: m1.publicKey(), amount: '100' }), Operation.clawback({ asset: EUR, from: m2.publicKey(), amount: '400' }), Operation.clawback({ asset: EUR, from: m3.publicKey(), amount: '400' }));
  ops.push(Operation.payment({ destination: mum.publicKey(), asset: EUR, amount: '900' }));
  log('ONE tx: freeze 3 + clawback 3 + restitution', await submit(iss.publicKey(), ops, [iss]));
  const bal = async k => ((await server.loadAccount(k.publicKey())).balances.find(b => b.asset_code === 'EURT') || {});
  log('balances mum/m1/m2/m3', await Promise.all([mum, m1, m2, m3].map(async k => { const b = await bal(k); return [b.balance, b.is_authorized]; })));
  log('m3 offers left', (await server.offers().forAccount(m3.publicKey()).call()).records.length);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
