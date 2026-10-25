// Spike (c): SA-1 Heirloom — pre-signed SetOptions with minSeqNum + minSeqAge; reset by activity; fee-bump by heir; revoke by bump
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Account, TransactionBuilder } = S;
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const WINDOW = 30;
(async () => {
  const owner = Keypair.random(), heir = Keypair.random();
  await Promise.all([fund(owner), fund(heir)]);
  const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(46), JSON.stringify(v));
  // init seqTime (account ext v3) with a no-op bump
  log('owner init bumpSequence', await submit(owner.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [owner]));
  const acc = await server.loadAccount(owner.publicKey());
  log('horizon sequence/sequence_time', [acc.sequence, acc.sequence_time]);
  const S0 = BigInt(acc.sequence);
  const mkWill = (offset) => {
    const willAcc = new Account(owner.publicKey(), (S0 + offset - 1n).toString());
    const tx = new TransactionBuilder(willAcc, { fee: '1000', networkPassphrase: NP })
      .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight: 1 } }))
      .setMinAccountSequence(S0.toString())
      .setMinAccountSequenceAge(BigInt(WINDOW))
      .setTimeout(0)
      .build();
    tx.sign(owner);
    return tx.toXDR();
  };
  const willXdr = mkWill(2n ** 32n);
  const submitWill = async (xdr) => {
    const inner = TransactionBuilder.fromXDR(xdr, NP);
    const fb = TransactionBuilder.buildFeeBumpTransaction(heir, '2000', inner, NP);
    fb.sign(heir);
    try { const r = await server.submitTransaction(fb); return { ok: true, hash: r.hash }; }
    catch (e) { const x = e?.response?.data?.extras?.result_codes; return { ok: false, codes: x || e.message }; }
  };
  log('heir submits will immediately', await submitWill(willXdr));
  await sleep(18);
  log('owner normal payment (activity) at ~t+18s', await submit(owner.publicKey(), [Operation.payment({ destination: heir.publicKey(), asset: Asset.native(), amount: '1' })], [owner]));
  await sleep(20);
  log('heir submits ~t+38s (20s after activity)', await submitWill(willXdr));
  await sleep(16);
  log('heir submits ~36s after activity', await submitWill(willXdr));
  const a2 = await server.loadAccount(owner.publicKey());
  log('owner signers after', a2.signers.map(s => [s.key.slice(0, 6), s.weight]));
  log('owner sequence after (jumped?)', a2.sequence);
  // revoke test: new owner2 with will, then bump past will seq
  const o2 = Keypair.random(); await fund(o2);
  await submit(o2.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [o2]);
  const s2 = BigInt((await server.loadAccount(o2.publicKey())).sequence);
  const w2 = new TransactionBuilder(new Account(o2.publicKey(), (s2 + 2n ** 32n - 1n).toString()), { fee: '1000', networkPassphrase: NP })
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight: 1 } }))
    .setMinAccountSequence(s2.toString()).setMinAccountSequenceAge(5n).setTimeout(0).build();
  w2.sign(o2);
  log('owner2 revoke: bumpSequence to will seq', await submit(o2.publicKey(), [Operation.bumpSequence({ bumpTo: (s2 + 2n ** 32n).toString() })], [o2]));
  await sleep(8);
  log('heir submits revoked will', await submitWill(w2.toXDR()));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
