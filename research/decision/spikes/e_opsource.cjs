// Spike (e): guardian undo with TX source = guardian account, OP source = parent; does parent's seq/seqTime stay untouched?
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Claimant } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
(async () => {
  const parent = Keypair.random(), guardian = Keypair.random(), recip = Keypair.random();
  await Promise.all([fund(parent), fund(guardian), fund(recip)]);
  const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(46), JSON.stringify(v));
  await submit(parent.publicKey(), [Operation.setOptions({ signer: { ed25519PublicKey: guardian.publicKey(), weight: 1 } }), Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 2, highThreshold: 2 })], [parent]);
  await submit(parent.publicKey(), [Operation.createClaimableBalance({ asset: Asset.native(), amount: '50', claimants: [
    new Claimant(recip.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(Math.floor(Date.now()/1000)+3600)))),
    new Claimant(parent.publicKey(), Claimant.predicateUnconditional())] })], [parent]);
  const id = (await server.claimableBalances().claimant(recip.publicKey()).call()).records[0].id;
  const a0 = await server.loadAccount(parent.publicKey());
  log('parent before: seq / sequence_time / XLM', [a0.sequence, a0.sequence_time, a0.balances[0].balance]);
  await sleep(6);
  log('undo: tx src=guardian, op src=parent, guardian sig', await submit(guardian.publicKey(), [Operation.claimClaimableBalance({ balanceId: id, source: parent.publicKey() })], [guardian]));
  const a1 = await server.loadAccount(parent.publicKey());
  log('parent after: seq / sequence_time / XLM', [a1.sequence, a1.sequence_time, a1.balances[0].balance]);
  log('guardian payment op src=parent via own tx', await submit(guardian.publicKey(), [Operation.payment({ source: parent.publicKey(), destination: guardian.publicKey(), asset: Asset.native(), amount: '5' })], [guardian]));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
