// Spike (d): two-stage will — stage1 heir LOW weight after T1 silence; stage2 heir HIGH after grace since stage1
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
(async () => {
  const owner = Keypair.random(), heir = Keypair.random();
  await Promise.all([fund(owner), fund(heir)]);
  const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(44), JSON.stringify(v));
  await submit(owner.publicKey(), [Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 2, highThreshold: 2 })], [owner]);
  const S0 = BigInt((await server.loadAccount(owner.publicKey())).sequence);
  const mk = (seq, minSeq, age, weight) => { const t = new TransactionBuilder(new Account(owner.publicKey(), (seq - 1n).toString()), { fee: '1000', networkPassphrase: NP })
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight } }))
    .setMinAccountSequence(minSeq.toString()).setMinAccountSequenceAge(BigInt(age)).setTimeout(0).build(); t.sign(owner); return t; };
  const st1 = mk(S0 + 2n ** 32n, S0, 15, 1), st2 = mk(S0 + 2n ** 33n, S0 + 2n ** 32n, 15, 2);
  const sub = async t => { const fb = TransactionBuilder.buildFeeBumpTransaction(heir, '2000', t, NP); fb.sign(heir);
    try { return { ok: true, hash: (await server.submitTransaction(fb)).hash }; } catch (e) { return { ok: false, codes: e?.response?.data?.extras?.result_codes || e.message }; } };
  log('stage2 before stage1', await sub(st2));
  await sleep(17);
  log('stage1 after 17s silence', await sub(st1));
  log('heir(low) payment from owner', await submit(owner.publicKey(), [Operation.payment({ destination: heir.publicKey(), asset: Asset.native(), amount: '5' })], [heir]));
  log('stage2 immediately after stage1', await sub(st2));
  await sleep(17);
  log('stage2 after 17s grace', await sub(st2));
  log('heir(high) payment from owner', await submit(owner.publicKey(), [Operation.payment({ destination: heir.publicKey(), asset: Asset.native(), amount: '5' })], [heir]));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
