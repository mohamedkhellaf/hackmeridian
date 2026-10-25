// Spike (i): C2 — customer pays BRZ, café receives EURC via path_payment_strict_receive through merchant offer
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset } = S;
const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(50), JSON.stringify(v));
(async () => {
  const iss = Keypair.random(), cust = Keypair.random(), cafe = Keypair.random(), mm = Keypair.random();
  await Promise.all([iss, cust, cafe, mm].map(fund));
  const BRZ = new Asset('BRZ', iss.publicKey()), EURC = new Asset('EURC', iss.publicKey());
  log('trustlines', [await submit(cust.publicKey(), [Operation.changeTrust({ asset: BRZ })], [cust]), await submit(cafe.publicKey(), [Operation.changeTrust({ asset: EURC })], [cafe]),
    await submit(mm.publicKey(), [Operation.changeTrust({ asset: BRZ }), Operation.changeTrust({ asset: EURC })], [mm])].map(r => r.ok));
  log('issue', (await submit(iss.publicKey(), [Operation.payment({ destination: cust.publicKey(), asset: BRZ, amount: '1000' }), Operation.payment({ destination: mm.publicKey(), asset: EURC, amount: '1000' })], [iss])).ok);
  // merchant/MM posts two-sided book: sells EURC for BRZ at 6.2 BRZ per EURC, and sells BRZ for EURC
  log('MM offer sell EURC buy BRZ @6.2', await submit(mm.publicKey(), [Operation.manageSellOffer({ selling: EURC, buying: BRZ, amount: '500', price: '6.2' })], [mm]));
  const p = await server.strictReceivePaths([BRZ], EURC, '10').call();
  log('horizon strictReceivePaths BRZ->10 EURC', p.records.map(r => ({ src: r.source_amount, path: r.path.length })));
  log('cust pathPaymentStrictReceive 10 EURC to cafe', await submit(cust.publicKey(), [Operation.pathPaymentStrictReceive({ sendAsset: BRZ, sendMax: '70', destination: cafe.publicKey(), destAsset: EURC, destAmount: '10', path: [] })], [cust]));
  const bal = async (k, a) => ((await server.loadAccount(k.publicKey())).balances.find(b => b.asset_code === a) || {}).balance;
  log('cafe EURC / cust BRZ / mm BRZ', [await bal(cafe, 'EURC'), await bal(cust, 'BRZ'), await bal(mm, 'BRZ')]);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
