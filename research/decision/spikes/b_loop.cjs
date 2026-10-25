// Spike (b): WI-1 Loop — A owes B, B owes C, C owes A; one self-to-self strict-send clears the cycle
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset } = S;
(async () => {
  const A = Keypair.random(), B = Keypair.random(), C = Keypair.random();
  await Promise.all([fund(A), fund(B), fund(C)]);
  const iou = k => new Asset(k === A ? 'AIOU' : k === B ? 'BIOU' : 'CIOU', k.publicKey());
  const log = (k, v) => console.log(k.padEnd(44), JSON.stringify(v));
  // trustlines: B holds A-IOU, C holds B-IOU, A holds C-IOU (limit = credit line 1000)
  log('B trusts AIOU', await submit(B.publicKey(), [Operation.changeTrust({ asset: iou(A), limit: '1000' })], [B]));
  log('C trusts BIOU', await submit(C.publicKey(), [Operation.changeTrust({ asset: iou(B), limit: '1000' })], [C]));
  log('A trusts CIOU', await submit(A.publicKey(), [Operation.changeTrust({ asset: iou(C), limit: '1000' })], [A]));
  // invoices: A pays B 100 AIOU (A owes B), B pays C 100 BIOU, C pays A 100 CIOU
  log('A->B 100 AIOU', await submit(A.publicKey(), [Operation.payment({ destination: B.publicKey(), asset: iou(A), amount: '100' })], [A]));
  log('B->C 100 BIOU', await submit(B.publicKey(), [Operation.payment({ destination: C.publicKey(), asset: iou(B), amount: '100' })], [B]));
  log('C->A 100 CIOU', await submit(C.publicKey(), [Operation.payment({ destination: A.publicKey(), asset: iou(C), amount: '100' })], [C]));
  // netting offers (passive, 1:1): C sells BIOU for its own CIOU; B sells AIOU for its own BIOU
  log('C passive offer sell BIOU buy CIOU', await submit(C.publicKey(), [Operation.createPassiveSellOffer({ selling: iou(B), buying: iou(C), amount: '100', price: '1' })], [C]));
  log('B passive offer sell AIOU buy BIOU', await submit(B.publicKey(), [Operation.createPassiveSellOffer({ selling: iou(A), buying: iou(B), amount: '100', price: '1' })], [B]));
  // clearing: A sends 60 CIOU to itself, path [BIOU], receives AIOU (burn)
  log('A self path_payment_strict_send 60', await submit(A.publicKey(), [Operation.pathPaymentStrictSend({
    sendAsset: iou(C), sendAmount: '60', destination: A.publicKey(), destAsset: iou(A), destMin: '60', path: [iou(B)] })], [A]));
  const bal = async (k, a) => ((await server.loadAccount(k.publicKey())).balances.find(b => b.asset_code === a.code) || {}).balance;
  console.log('after: A holds CIOU', await bal(A, iou(C)), '| B holds AIOU', await bal(B, iou(A)), '| C holds BIOU', await bal(C, iou(B)));
  // Horizon pathfinding check (does it find the self-cycle?)
  try {
    const p = await server.strictSendPaths(iou(C), '10', [iou(A)]).call();
    console.log('horizon strictSendPaths C->A found', p.records.length, 'paths:', JSON.stringify(p.records.map(r => r.path.map(x => x.asset_code))));
  } catch (e) { console.log('horizon paths error', e.message); }
  // rippling exploit check: outsider D holding CIOU? (skip) — log offer state
  const offers = await server.offers().forAccount(C.publicKey()).call();
  console.log('C remaining offer amount', offers.records.map(o => o.amount));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
