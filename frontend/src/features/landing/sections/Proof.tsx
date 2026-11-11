import type { ReactNode } from 'react'
import { explorerTx } from '../../../core/explorer'
import { formatUnits, groupDigits } from '../../../core/format'
import { Link, Table, TableWrap, TBody, Td, Th, THead, Tr, TxLink } from '../../../ui'
import { DOC_LINKS, PROOF, SECTION } from '../copy'
import { CONTRACT_TESTS, CONTRACT_TEST_TOTAL, DEPLOYED_WASM_BYTES, DEPLOYED_WASM_SHA256, EVIDENCE_TX, RECORDED_PUT_TX } from '../recorded'
import { Section } from './Section'
import css from './Proof.module.css'

const tx = (hash: string) => <TxLink hash={hash} explorerUrl={explorerTx(hash)} />

interface Row {
  id: string
  claim: string
  kind: string
  evidence: ReactNode
}

const ROWS: Row[] = [
  {
    id: 'tests',
    claim: PROOF.tests(CONTRACT_TEST_TOTAL, CONTRACT_TESTS.unit, CONTRACT_TESTS.invariant, CONTRACT_TESTS.negative),
    kind: PROOF.kind.tests,
    evidence: (
      <Link external href={DOC_LINKS.tests}>
        {PROOF.testsEvidence}
      </Link>
    ),
  },
  {
    id: 'admin',
    claim: PROOF.admin,
    kind: PROOF.kind.source,
    evidence: (
      <Link external href={DOC_LINKS.source}>
        {PROOF.adminEvidence}
      </Link>
    ),
  },
  {
    id: 'wasm',
    claim: PROOF.wasm(groupDigits(String(DEPLOYED_WASM_BYTES))),
    kind: PROOF.kind.record,
    evidence: (
      <>
        <Link external href={DOC_LINKS.evidence}>
          {PROOF.wasmEvidence}
        </Link>
        <span className={css.hash}>
          {PROOF.shaLabel} {DEPLOYED_WASM_SHA256.slice(0, 8)}…{DEPLOYED_WASM_SHA256.slice(-4)}
        </span>
        {tx(EVIDENCE_TX.deploy)}
      </>
    ),
  },
  {
    id: 'lifecycle',
    claim: PROOF.lifecycle,
    kind: PROOF.kind.txs,
    evidence: (
      <>
        {tx(RECORDED_PUT_TX.write.hash)}
        {tx(RECORDED_PUT_TX.buy.hash)}
        {tx(RECORDED_PUT_TX.exercise.hash)}
        {tx(RECORDED_PUT_TX.claim.hash)}
      </>
    ),
  },
  { id: 'fee', claim: PROOF.fee(formatUnits(RECORDED_PUT_TX.exercise.feeStroops, 7, { dp: 7 })), kind: PROOF.kind.tx, evidence: tx(RECORDED_PUT_TX.exercise.hash) },
  { id: 'issuer', claim: PROOF.issuer, kind: PROOF.kind.tx, evidence: tx(EVIDENCE_TX.authorize) },
  {
    id: 'clawback',
    claim: PROOF.clawback,
    kind: PROOF.kind.txs,
    evidence: (
      <>
        {tx(EVIDENCE_TX.clawback)}
        {tx(EVIDENCE_TX.repay)}
      </>
    ),
  },
  { id: 'resale', claim: PROOF.resale, kind: PROOF.kind.tx, evidence: tx(EVIDENCE_TX.resale) },
  { id: 'request', claim: PROOF.request, kind: PROOF.kind.tx, evidence: tx(EVIDENCE_TX.fillBid) },
]

export function Proof() {
  return (
    <Section id={SECTION.proof} heading={PROOF.heading} lead={PROOF.lead}>
      <TableWrap label={PROOF.tableCaption}>
        <Table caption={PROOF.tableCaption} className={css.table}>
          <THead>
            <Tr>
              <Th>{PROOF.columns.claim}</Th>
              <Th>{PROOF.columns.evidence}</Th>
            </Tr>
          </THead>
          <TBody>
            {ROWS.map((row) => (
              <Tr key={row.id}>
                <Td className={css.claim}>{row.claim}</Td>
                <Td className={css.evidence}>
                  <span className={css.kind}>{row.kind}</span>
                  <span className={css.links}>{row.evidence}</span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      <p className={css.all}>
        <Link external href={DOC_LINKS.evidence}>
          {PROOF.all}
        </Link>
      </p>
    </Section>
  )
}
