// (d+) force an ON-CHAIN failure: simulate H.exercise(put #3) OK, then issuer revokes H classically, then submit the prepared tx
const { S, server, NP, submit } = require('../common.cjs');
const { rpc, Contract, nativeToScVal, Address, TransactionBuilder, Keypair, Operation, Asset } = S;
const K = require('./keys.json'); const H = Keypair.fromSecret(K.H.sec), I = Keypair.fromSecret(K.I.sec);
const rs = new rpc.Server('https://soroban-testnet.stellar.org');
const OPT = 'CC2UWWGG2SAMMQZ535XO4ACINKPTWRQLCY6RWT27K374KO3PTTCTKKKL', FUND = new Asset('FUND', K.I.pub);
(async () => {
  const acc = await rs.getAccount(H.publicKey());
  const tx = new TransactionBuilder(acc, { fee: '1000000', networkPassphrase: NP })
    .addOperation(new Contract(OPT).call('exercise', new Address(H.publicKey()).toScVal(), nativeToScVal(3, { type: 'u32' }))).setTimeout(120).build();
  const prepared = await rs.prepareTransaction(tx); prepared.sign(H);
  console.log('simulation OK; now issuer revokes H via classic SetTrustLineFlags');
  console.log('revoke', JSON.stringify(await submit(K.I.pub, [Operation.setTrustLineFlags({ trustor: H.publicKey(), asset: FUND, flags: { authorized: false } })], [I])));
  const sent = await rs.sendTransaction(prepared); console.log('send', sent.status, sent.hash);
  let r; for (let i = 0; i < 20; i++) { r = await rs.getTransaction(sent.hash); if (r.status !== 'NOT_FOUND') break; await new Promise(z => setTimeout(z, 1500)); }
  console.log('on-chain status', r.status, 'ledger', r.ledger);
  console.log('reauth', JSON.stringify(await submit(K.I.pub, [Operation.setTrustLineFlags({ trustor: H.publicKey(), asset: FUND, flags: { authorized: true } })], [I])));
})().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
