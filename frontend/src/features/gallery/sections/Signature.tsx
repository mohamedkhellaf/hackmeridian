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
        note="Offers, positions, bids and receipts. A mono serial line (the id and the ledger it was read at), the payoff glyph with the kind in words, the terms as a ruled list, the state as the only tag."
        layout="split"
      >
        <ContractNote
          serial="000184"
          ledger="58,331,204"
          glyph="long-put"
          kind="Long put, BOND"
          state="Active"
          aside={<Countdown to={SAMPLE_DEADLINE} now={SAMPLE_NOW} />}
          terms={[
            { label: 'Strike', value: <Amount value="10.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'Quantity', value: <Amount value="5" unit="BOND" figure="serif" /> },
            { label: 'Premium paid', value: <Amount value="1.80" exact="1.8000000" unit="USDx" figure="serif" /> },
            { label: 'Breakeven', value: '9.64', marked: true },
            {
              label: 'Deadline',
              value: <DateTime value={SAMPLE_DEADLINE} local="below" />,
            },
            { label: 'Collateral', value: '50.00 USDx in contract' },
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
          serial="000207"
          ledger="58,331,204"
          serialLabel="Offer No."
          glyph="short-call"
          kind="Short call, FUND"
          state="Offered"
          terms={[
            { label: 'Strike', value: <Amount value="11.00" unit="USDx" figure="serif" /> },
            { label: 'Quantity', value: <Amount value="20" unit="FUND" figure="serif" /> },
            { label: 'Premium asked', value: <Amount value="3.80" unit="USDx" figure="serif" />, marked: true },
            { label: 'Deadline', value: <DateTime value={SAMPLE_DEADLINE} /> },
            { label: 'Collateral', value: '20 FUND in contract' },
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
          serial="000311"
          ledger="58,331,260"
          glyph="long-put"
          kind="Long put, BOND"
          state="Active"
          terms={[
            { label: 'Floor', value: <Amount value="10.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'You paid', value: <Amount value="1.80" unit="USDx" figure="serif" />, hint: 'A caption can sit under a value.' },
            { label: 'Deadline', value: <DateTime value={SAMPLE_DEADLINE} /> },
          ]}
          footer={<TxLink hash={SAMPLE_HASH} explorerUrl="https://stellar.expert/explorer/testnet" />}
        />
        <Example label="Replays the entrance of the note on the left">
          <Button onClick={() => setPrintKey((k) => k + 1)}>Print the note again</Button>
        </Example>
      </Specimen>

      <Specimen
        title="Empty note"
        note="Every empty state: a blank, dashed slip with one serif sentence and at most one action."
        layout="split"
      >
        <EmptyNote
          title="No positions."
          hint="Terms appear here once you hold or write an option."
          action={<ButtonLink href="#signature">Open Markets</ButtonLink>}
        />
        <EmptyNote title="No open offers on BOND." hint="Post a request and escrow your premium, or write the first offer." />
      </Specimen>

      <Specimen
        title="Highlighter"
        note="Only behind figures that are the user's own terms: their strike, their breakeven, their offer. Never for emphasis. On Carbon it is a dark wash with a yellow underline."
        layout="stack"
      >
        <p className={styles.prose}>
          If BOND is at 8.00 at the deadline you still sell at <Marker>10.00</Marker>. Your breakeven is{' '}
          <Marker>9.64</Marker>, the floor less the 0.36 per unit you paid.
        </p>
        <p className="ui-display">
          Set the <Marker band>lowest price</Marker> you would sell at.
        </p>
        <Example label="A changed figure flashes the marker for 1.2 s, then it is plain again">
          <span className="ui-figure-lg">
            <Marker key={printKey} flash>
              48.20 USDx
            </Marker>
          </span>
        </Example>
      </Specimen>
    </Section>
  )
}
