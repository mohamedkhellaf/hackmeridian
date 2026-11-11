import type { ReactNode } from 'react'
import { explorerTx } from '../../../core/explorer'
import { formatUnits } from '../../../core/format'
import { Link, Table, TableWrap, TBody, Td, Th, THead, Tr, TxLink } from '../../../ui'
import { DOC_LINKS, PROOF, SECTION } from '../copy'
import { CONTRACT_TESTS, CONTRACT_TEST_TOTAL, EVIDENCE_TX, RECORDED_PUT_TX } from '../recorded'
import { Section } from './Section'
import css from './Proof.module.css'

const tx = (hash: string) => <TxLink hash={hash} explorerUrl={explorerTx(hash)} />

interface Row {
  id: string
  claim: string
  evidence: ReactNode
}

/**
 * Each claim beside its one piece of evidence. The transactions of the recorded option are the "How it works"
 * table above; they are not repeated here.
 */
const ROWS: Row[] = [
  {
    id: 'tests',
    claim: PROOF.tests(CONTRACT_TEST_TOTAL, CONTRACT_TESTS.unit, CONTRACT_TESTS.invariant, CONTRACT_TESTS.negative),
    evidence: (
      <Link external href={DOC_LINKS.tests}>
        {PROOF.testsEvidence}
      </Link>
    ),
  },
  {
    id: 'admin',
    claim: PROOF.admin,
    evidence: (
      <Link external href={DOC_LINKS.source}>
        {PROOF.adminEvidence}
      </Link>
    ),
  },
  {
    id: 'wasm',
    claim: PROOF.wasm,
    evidence: (
      <Link external href={DOC_LINKS.evidence}>
        {PROOF.wasmEvidence}
      </Link>
    ),
  },
  { id: 'fee', claim: PROOF.fee(formatUnits(RECORDED_PUT_TX.exercise.feeStroops, 7, { dp: 7 })), evidence: tx(RECORDED_PUT_TX.exercise.hash) },
  { id: 'issuer', claim: PROOF.issuer, evidence: tx(EVIDENCE_TX.authorize) },
  {
    id: 'clawback',
    claim: PROOF.clawback,
    evidence: (
      <>
        {tx(EVIDENCE_TX.clawback)}
        {tx(EVIDENCE_TX.repay)}
      </>
    ),
  },
  { id: 'resale', claim: PROOF.resale, evidence: tx(EVIDENCE_TX.resale) },
  { id: 'request', claim: PROOF.request, evidence: tx(EVIDENCE_TX.fillBid) },
]

/*
 * Under 600 px each row becomes a block (the claim, then its evidence), so the CSS sets the cells to `display:
 * block`. That drops the implicit table roles, so they are given explicitly here.
 */
export function Proof() {
  return (
    <Section id={SECTION.proof} heading={PROOF.heading}>
      <TableWrap label={PROOF.tableCaption}>
        <Table caption={PROOF.tableCaption} className={css.table} role="table">
          <THead role="rowgroup">
            <Tr role="row">
              <Th role="columnheader">{PROOF.columns.claim}</Th>
              <Th role="columnheader">{PROOF.columns.evidence}</Th>
            </Tr>
          </THead>
          <TBody role="rowgroup">
            {ROWS.map((row) => (
              <Tr key={row.id} role="row">
                <Td className={css.claim} role="cell">
                  {row.claim}
                </Td>
                <Td className={css.evidence} role="cell">
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
