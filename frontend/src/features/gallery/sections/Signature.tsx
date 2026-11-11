import { useState } from 'react'
import { Amount, Button, ButtonLink, ContractNote, Countdown, DateTime, EmptyNote, IconCalendarAdd, Marker, TxLink } from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { SAMPLE_DEADLINE, SAMPLE_HASH, SAMPLE_NOW } from './sample'

export function SignatureSection() {
  const [printKey, setPrintKey] = useState(0)
  return (
    <Section
      id="signature"
      title="Signature pieces"
      lead="The contract note is the visual unit of the product: an option as a typeset slip, with nothing left out. Boldness is spent here; everything around it stays quiet."
    >
      <Specimen
        title="Contract note"
        note="An offer, a position, a request or a receipt: a contract object with a number in the contract. A mono serial line (the id and the ledger), the payoff glyph with the kind in words, the terms as a ruled list, the state as the only tag. One marked figure per note."
        layout="split"
      >
        <ContractNote
          serial="184"
          ledger="58,331,204"
          glyph="long-put"
          kind="Long put, BOND"
          state="Active"
          aside={<Countdown to={SAMPLE_DEADLINE} now={SAMPLE_NOW} />}
          terms={[
            { label: 'Strike', value: <Amount value="10.00" unit="USDx" figure="serif" /> },
            { label: 'Quantity', value: <Amount value="5.00" unit="BOND" figure="serif" /> },
            { label: 'Premium paid', value: <Amount value="1.80" exact="1.8000000" unit="USDx" figure="serif" /> },
            { label: 'Breakeven', value: <Amount value="9.64" unit="USDx" figure="serif" />, marked: true },
            {
              label: 'Deadline',
              value: <DateTime value={SAMPLE_DEADLINE} local="below" />,
            },
            { label: 'Collateral', value: <Amount value="50.00" unit="USDx" figure="serif" />, hint: 'In the contract' },
          ]}
          footer={
            <>
              <TxLink hash={SAMPLE_HASH} explorerUrl="https://stellar.expert/explorer/testnet" copy />
              <Button size="sm" variant="secondary" iconStart={<IconCalendarAdd />}>
                Add to calendar
              </Button>
            </>
          }
        />
        <ContractNote
          serial="207"
          ledger="58,331,204"
          serialLabel="Offer No."
          glyph="short-call"
          kind="Short call, FUND"
          state="Offered"
          terms={[
            { label: 'Strike', value: <Amount value="11.00" unit="USDx" figure="serif" /> },
            { label: 'Quantity', value: <Amount value="20.00" unit="FUND" figure="serif" /> },
            { label: 'Premium asked', value: <Amount value="3.80" unit="USDx" figure="serif" />, marked: true },
            { label: 'Deadline', value: <DateTime value={SAMPLE_DEADLINE} /> },
            { label: 'Collateral', value: <Amount value="20.00" unit="FUND" figure="serif" />, hint: 'In the contract' },
          ]}
          footer={
            <Button size="sm" variant="secondary">
              Cancel offer
            </Button>
          }
        />
      </Specimen>

      <Specimen
        title="Receipt"
        note="On a confirmed trade the note prints: it rises 6 px and settles from 1.02 to 1 in 360 ms, and the serial line comes in after. With reduced motion it simply appears."
        layout="split"
      >
        <ContractNote
          key={printKey}
          printing={printKey > 0}
          serial="311"
          ledger="58,331,260"
          glyph="long-put"
          kind="Long put, BOND"
          state="Active"
          terms={[
            { label: 'Floor', value: <Amount value="10.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'You paid', value: <Amount value="1.80" unit="USDx" figure="serif" />, hint: '0.36 USDx per BOND' },
            { label: 'Deadline', value: <DateTime value={SAMPLE_DEADLINE} /> },
          ]}
          footer={<TxLink hash={SAMPLE_HASH} explorerUrl="https://stellar.expert/explorer/testnet" />}
        />
        <Example label="Replays the entrance of the note on the left">
          <Button onClick={() => setPrintKey((k) => k + 1)}>Print the note again</Button>
        </Example>
      </Specimen>

      <Specimen
        title="Plain note"
        note="The same card for a form or an example, not a contract object: plain drops the perforated edge and the serial line."
        layout="split"
      >
        <ContractNote
          plain
          glyph="long-put"
          kind="A floor on BOND"
          terms={[
            { label: 'Floor', value: <Amount value="99.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'Quantity', value: <Amount value="2.00" unit="BOND" figure="serif" /> },
            { label: 'Deadline', value: <DateTime value={SAMPLE_DEADLINE} /> },
          ]}
        />
      </Specimen>

      <Specimen
        title="Empty note"
        note="One serif sentence, at most one short line and one action, on the page. With slip, the same words on a blank contract note: only where the missing thing is itself a contract note."
        layout="split"
      >
        <EmptyNote title="No open offers on BOND." hint="Post a request and escrow your premium, or write the first offer." />
        <EmptyNote
          slip
          title="No positions."
          hint="Terms appear here once you hold or write an option."
          action={<ButtonLink href="#signature">Go to Markets</ButtonLink>}
        />
      </Specimen>

      <Specimen
        title="Highlighter"
        note="One stroke of wash, in both themes, behind one figure per surface: a term the user set (their floor, their price) or, on the term sheet of their own order or position, the breakeven. Never a headline word, a price somebody else set, an example or emphasis."
        layout="stack"
      >
        <p className={styles.prose}>
          If BOND is at 8.00 at the deadline you still sell at <Marker>10.00</Marker>, the floor you chose.
        </p>
        <Example label="A changed figure flashes the marker for 1.2 s, then it is plain again">
          <Marker key={printKey} flash>
            <Amount value="48.20" unit="USDx" figure="serif" size="lg" />
          </Marker>
        </Example>
      </Specimen>
    </Section>
  )
}
