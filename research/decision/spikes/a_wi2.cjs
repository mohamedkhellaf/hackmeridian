// Spike (a): WI-2 Second Thought — CB undo window + guardian low-threshold claim + guardian cannot pay
const { S, server, fund, submit } = require('./common.cjs');
const { Keypair, Operation, Asset, Claimant } = S;
(async () => {
  const parent = Keypair.random(), guardian = Keypair.random(), recip = Keypair.random();
  await Promise.all([fund(parent), fund(guardian), fund(recip)]);
  const log = (k, v) => console.log(k.padEnd(48), JSON.stringify(v));
  // 1. multisig: parent master 2, guardian 1, thresholds low1 med2 high2
  log('setOptions weights', await submit(parent.publicKey(), [
    Operation.setOptions({ signer: { ed25519PublicKey: guardian.publicKey(), weight: 1 } }),
    Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 2, highThreshold: 2 }),
  ], [parent]));
  // 2. parent creates CB of 100 XLM: recipient after now+60s, parent unconditional
  const t = Math.floor(Date.now() / 1000) + 60;
  const cb = await submit(parent.publicKey(), [Operation.createClaimableBalance({
    asset: Asset.native(), amount: '100',
    claimants: [
      new Claimant(recip.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(t)))),
      new Claimant(parent.publicKey(), Claimant.predicateUnconditional()),
    ],
  })], [parent]);
  log('createClaimableBalance (parent signs)', cb);
  const list = await server.claimableBalances().claimant(recip.publicKey()).call();
  const id = list.records[0].id;
  // 3. recipient claims early -> expect failure
  log('recipient claims early', await submit(recip.publicKey(), [Operation.claimClaimableBalance({ balanceId: id })], [recip]));
  // 4. guardian alone tries Payment from parent -> expect tx_bad_auth
  log('guardian-only Payment from parent', await submit(parent.publicKey(), [Operation.payment({ destination: guardian.publicKey(), asset: Asset.native(), amount: '10' })], [guardian]));
  // 5. guardian alone claims CB back to parent (parent-sourced tx, guardian signature only)
  const before = (await server.loadAccount(parent.publicKey())).balances.find(b => b.asset_type === 'native').balance;
  log('guardian-only Claim (undo) on parent acct', await submit(parent.publicKey(), [Operation.claimClaimableBalance({ balanceId: id })], [guardian]));
  const after = (await server.loadAccount(parent.publicKey())).balances.find(b => b.asset_type === 'native').balance;
  log('parent XLM before/after undo', [before, after]);
  // 6. second CB, then recipient claims after window (short 15s window)
  const t2 = Math.floor(Date.now() / 1000) + 15;
  await submit(parent.publicKey(), [Operation.createClaimableBalance({ asset: Asset.native(), amount: '5', claimants: [
    new Claimant(recip.publicKey(), Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(String(t2)))),
    new Claimant(parent.publicKey(), Claimant.predicateUnconditional())] })], [parent]);
  const id2 = (await server.claimableBalances().claimant(recip.publicKey()).call()).records[0].id;
  await new Promise(r => setTimeout(r, 22000));
  log('recipient claims after window', await submit(recip.publicKey(), [Operation.claimClaimableBalance({ balanceId: id2 })], [recip]));
  // 7. guardian alone tries setOptions (high) -> expect bad auth
  log('guardian-only setOptions (high)', await submit(parent.publicKey(), [Operation.setOptions({ masterWeight: 0 })], [guardian]));
  // 8. guardian alone BumpSequence (low) -> expect success (disclosure point)
  log('guardian-only bumpSequence (low)', await submit(parent.publicKey(), [Operation.bumpSequence({ bumpTo: '0' })], [guardian]));
  console.log('accounts', { parent: parent.publicKey(), guardian: guardian.publicKey(), recip: recip.publicKey() });
})().catch(e => { console.error('FATAL', e); process.exit(1); });
