// Spike (f): integrated S1 table — Mum 2 / Policy 1 / Guardian 1; thresholds low1 med3 high3
const { S, server, NP, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Claimant } = S;
(async () => {
  const mum = Keypair.random(), pol = Keypair.random(), gua = Keypair.random(), rec = Keypair.random(), fam = Keypair.random();
  await Promise.all([mum, pol, gua, rec, fam].map(fund));
  const log = (k, v) => console.log(new Date().toISOString().slice(11, 19), k.padEnd(52), JSON.stringify(v));
  const M = mum.publicKey();
  log('setup signers/thresholds', await submit(M, [
    Operation.setOptions({ signer: { ed25519PublicKey: pol.publicKey(), weight: 1 } }),
    Operation.setOptions({ signer: { ed25519PublicKey: gua.publicKey(), weight: 1 } }),
    Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 3, highThreshold: 3 })], [mum]));
  const pay = Operation.payment({ destination: rec.publicKey(), asset: Asset.native(), amount: '10' });
  log('(1) Mum alone Payment', await submit(M, [pay], [mum]));
  log('(2) Mum+Policy Payment', await submit(M, [pay], [mum, pol]));
  const T = Math.floor(Date.now() / 1000) + 86400;
  log('(3a) Mum+Policy 24h CB', await submit(M, [Operation.createClaimableBalance({ asset: Asset.native(), amount: '50', claimants: [
    new Claimant(rec.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(T)))), new Claimant(M, Claimant.predicateUnconditional())] })], [mum, pol]));
  const id = (await server.claimableBalances().claimant(rec.publicKey()).call()).records[0].id;
  const b0 = await server.loadAccount(M);
  log('(3b) guardian undo (tx src guardian, op src Mum)', await submit(gua.publicKey(), [Operation.claimClaimableBalance({ balanceId: id, source: M })], [gua]));
  const b1 = await server.loadAccount(M);
  log('     Mum XLM / seq / seqTime before→after', [b0.balances[0].balance, b1.balances[0].balance, b0.sequence === b1.sequence, b0.sequence_time === b1.sequence_time]);
  log('(4) Guardian+Policy Payment', await submit(M, [pay], [gua, pol]));
  log('(5) Guardian+Policy SetOptions remove Mum', await submit(M, [Operation.setOptions({ masterWeight: 0 })], [gua, pol]));
  log('(7) sponsored CB: family sponsors Mum CB reserve', await submit(M, [
    Operation.beginSponsoringFutureReserves({ sponsoredId: M, source: fam.publicKey() }),
    Operation.createClaimableBalance({ asset: Asset.native(), amount: '5', claimants: [new Claimant(rec.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(T)))), new Claimant(M, Claimant.predicateUnconditional())] }),
    Operation.endSponsoringFutureReserves({})], [mum, pol, fam]));
  const cbs = (await server.claimableBalances().claimant(rec.publicKey()).call()).records;
  log('     CB sponsors', cbs.map(c => c.sponsor && c.sponsor.slice(0, 6) + (c.sponsor === fam.publicKey() ? '=family' : c.sponsor === M ? '=mum' : '')));
  log('(6) Mum+Guardian SetOptions remove Policy', await submit(M, [Operation.setOptions({ signer: { ed25519PublicKey: pol.publicKey(), weight: 0 } })], [mum, gua]));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
