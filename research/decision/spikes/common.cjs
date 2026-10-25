const S = require('/home/mo/projects/lisbon/frontend/node_modules/@stellar/stellar-sdk');
const { Horizon, Keypair, TransactionBuilder, Networks } = S;
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const NP = Networks.TESTNET;

async function fund(kp) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!r.ok) throw new Error('friendbot ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
function codes(e) {
  const x = e?.response?.data?.extras?.result_codes;
  return x ? JSON.stringify(x) : (e.message || String(e));
}
// build+sign+submit; returns {ok, hash|codes}
async function submit(sourcePub, ops, signers, opts = {}) {
  const acc = await server.loadAccount(sourcePub);
  let b = new TransactionBuilder(acc, { fee: '1000', networkPassphrase: NP, ...(opts.builder || {}) });
  ops.forEach(o => (b = b.addOperation(o)));
  if (opts.pre) opts.pre(b);
  else b = b.setTimeout(120);
  const tx = b.build();
  signers.forEach(k => tx.sign(k));
  try {
    const r = await server.submitTransaction(tx);
    return { ok: true, hash: r.hash };
  } catch (e) {
    return { ok: false, codes: codes(e) };
  }
}
module.exports = { S, server, NP, fund, submit, codes };
