// Spike (g): inbound payment does NOT reset seqTime; no-op BumpSequence by Mum DOES
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
(async () => {
  const mum = Keypair.random(), son = Keypair.random();
  await Promise.all([fund(mum), fund(son)]);
  const st = async () => { const a = await server.loadAccount(mum.publicKey()); return [a.sequence, a.sequence_time]; };
  const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(40), JSON.stringify(v));
  log('init bump', await submit(mum.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [mum]));
  log('mum seq/seqTime t0', await st());
  await sleep(7);
  log('inbound payment son->mum', await submit(son.publicKey(), [Operation.payment({ destination: mum.publicKey(), asset: Asset.native(), amount: '50' })], [son]));
  log('mum seq/seqTime after inbound', await st());
  await sleep(7);
  log('mum no-op bumpSequence(0)', await submit(mum.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [mum]));
  log('mum seq/seqTime after heartbeat', await st());
})().catch(e => { console.error('FATAL', e); process.exit(1); });
