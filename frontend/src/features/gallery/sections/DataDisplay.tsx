import { useState } from 'react'
import {
  Address,
  Amount,
  Button,
  Card,
  Countdown,
  DateTime,
  Glyph,
  KeyValue,
  KeyValueItem,
  Marker,
  RowHeader,
  Stat,
  TBody,
  THead,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
  Tr,
  TxLink,
} from '../../../ui'
import type { SortDirection } from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { EXPLORER, SAMPLE_ADDRESS, SAMPLE_CONTRACT, SAMPLE_DEADLINE, SAMPLE_HASH, SAMPLE_NOW } from './sample'

const CHAIN = [
  { strike: '9.00', call: '1.08', put: '0.12' },
  { strike: '9.50', call: '0.71', put: '0.24' },
  { strike: '10.00', call: '0.38', put: '0.36', mine: true },
  { strike: '10.50', call: '0.19', put: '0.74' },
  { strike: '11.00', call: '0.09', put: null },
]

const POSITIONS = [
  { id: '184', asset: 'BOND', kind: 'Long put', glyph: 'long-put' as const, strike: '10.00', qty: '5.00', premium: '1.80', state: 'Active' },
  { id: '171', asset: 'FUND', kind: 'Short call', glyph: 'short-call' as const, strike: '11.00', qty: '20.00', premium: '3.80', state: 'Offered' },
  { id: '150', asset: 'EQTY', kind: 'Long call', glyph: 'long-call' as const, strike: '24.00', qty: '2.00', premium: '0.90', state: 'Exercised' },
  { id: '122', asset: 'BOND', kind: 'Short put', glyph: 'short-put' as const, strike: '9.50', qty: '10.00', premium: '2.40', state: 'Expired' },
]

export function DataSection() {
  const [sort, setSort] = useState<SortDirection>('asc')
  const rows = [...POSITIONS].sort((a, b) => (sort === 'desc' ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id)))
  return (
    <Section
      id="data"
      title="Data display"
      lead="Figures are exact, truncated and tabular, with the unit once. The serif gives a figure rank; dense tables stay in the sans, except the strike column."
    >
      <Specimen
        title="Table, the chain"
        note="A native table, ruled like a statement: header underline, row hairlines, no box, no zebra. Calls left, strike in the centre on the sunken tone, puts right. An empty half shows nothing at rest. Your own figure carries the highlighter."
        layout="stack"
      >
        <TableWrap label="BOND option chain, 13 Nov 2026">
          <Table density="compact" caption="BOND option chain for 13 Nov 2026, premiums in USDx per unit">
            <THead>
              <Tr>
                <Th numeric>
                  <span className={styles.inlineGlyph}>
                    <Glyph name="long-call" /> Call premium
                  </span>
                </Th>
                <Th strike>Strike</Th>
                <Th numeric>
                  <span className={styles.inlineGlyph}>
                    <Glyph name="long-put" /> Put premium
                  </span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {CHAIN.map((row) => (
                <Tr key={row.strike} interactive>
                  <Td numeric>{row.call}</Td>
                  <Td strike>{row.strike}</Td>
                  <Td numeric>
                    {row.put === null ? (
                      <span className="ui-vh">No offer</span>
                    ) : row.mine ? (
                      <Marker>{row.put}</Marker>
                    ) : (
                      row.put
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Specimen>

      <Specimen
        title="Table, positions"
        note="Comfortable rows, a sortable header, a selected row, a row header, the state as a tag and a pinned action column. Narrow the window: the table scrolls inside its wrapper, which becomes a focusable region."
        layout="stack"
      >
        <TableWrap label="Positions">
          <Table caption="Positions">
            <THead>
              <Tr>
                <Th sort={sort} onSort={() => setSort(sort === 'asc' ? 'desc' : 'asc')}>
                  No.
                </Th>
                <Th>Asset</Th>
                <Th>Kind</Th>
                <Th numeric>Strike (USDx)</Th>
                <Th numeric>Quantity</Th>
                <Th numeric>Premium (USDx)</Th>
                <Th>Deadline (UTC)</Th>
                <Th>Maker</Th>
                <Th>State</Th>
                <Th pinned>
                  <span className="ui-vh">Action</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id} interactive selected={row.id === '184'}>
                  <Td>
                    <span className="ui-mono">{row.id}</span>
                  </Td>
                  <RowHeader>{row.asset}</RowHeader>
                  <Td>
                    <span className={styles.inlineGlyph}>
                      <Glyph name={row.glyph} /> {row.kind}
                    </span>
                  </Td>
                  <Td numeric>{row.strike}</Td>
                  <Td numeric>{row.qty}</Td>
                  <Td numeric>{row.premium}</Td>
                  <Td>
                    <DateTime value={SAMPLE_DEADLINE} format="table" />
                  </Td>
                  <Td>
                    <Address value={SAMPLE_ADDRESS} copyLabel={null} />
                  </Td>
                  <Td>
                    <Tag state={row.state} />
                  </Td>
                  <Td pinned>
                    {row.state === 'Active' ? (
                      <Button size="sm" variant="secondary">
                        Exercise
                      </Button>
                    ) : row.state === 'Offered' ? (
                      <Button size="sm" variant="secondary">
                        Cancel offer
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Specimen>

      <Specimen title="Key and value" note="Always dl, div, dt, dd. Ruled with serif figures for terms and impact summaries; plain and sans for dense facts." layout="split" surface>
        <KeyValue>
          <KeyValueItem label="You pay">
            <Amount value="1.80" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Breakeven" marked>
            <Amount value="9.64" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Most you can lose">
            <Amount value="1.80" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Deadline">
            <DateTime value={SAMPLE_DEADLINE} local="below" />
          </KeyValueItem>
        </KeyValue>
        <KeyValue variant="plain" figures="sans">
          <KeyValueItem label="Approval required">No</KeyValueItem>
          <KeyValueItem label="Can freeze">Yes</KeyValueItem>
          <KeyValueItem label="Can claw back">Yes</KeyValueItem>
          <KeyValueItem label="Issuer">
            <Address value={SAMPLE_ADDRESS} copyLabel={null} />
          </KeyValueItem>
        </KeyValue>
        <KeyValue layout="stacked">
          <KeyValueItem label="Quantity">
            <Amount value="5.00" unit="BOND" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Floor, per unit" marked>
            <Amount value="10.00" unit="USDx" figure="serif" />
          </KeyValueItem>
        </KeyValue>
      </Specimen>

      <Specimen title="Stat" note="A key figure with its label. Real, exact figures only, and never more than four in a row.">
        <div className={styles.statRow}>
          <Stat size="lg" label="Premium paid" value="1.80" unit="USDx" />
          <Stat size="lg" label="Premium earned" value="3.80" unit="USDx" />
          <Stat size="lg" label="Locked" value="220.00" unit="USDx" hint="In the Covered contract" />
        </div>
        <div className={styles.statRow}>
          <Stat label="Reference price" value="9.82" unit="USDx" hint="Demo price" />
          <Stat label="Nearest deadline" value="2 d 4 h" />
        </div>
      </Specimen>

      <Specimen title="Card" note="A sheet for one discrete object. No shadow, no nesting. Lists of things are tables." layout="split">
        <Card title="Reserves, USDx" actions={<span className="ui-caption">Read at ledger 58,331,204</span>}>
          <KeyValue figures="sans" variant="plain">
            <KeyValueItem label="Locked">220.00</KeyValueItem>
            <KeyValueItem label="Held">220.00</KeyValueItem>
            <KeyValueItem label="Difference">0.00</KeyValueItem>
          </KeyValue>
        </Card>
        <Card tone="sunken" title="Margin" headingLevel={3}>
          <p className="ui-text">A fenced block: a separate contract, shown apart from Covered.</p>
        </Card>
        <Card tone="plain" padding="sm">
          <p className="ui-text">Plain, with a rule and no fill.</p>
        </Card>
      </Specimen>

      <Specimen
        title="Amount"
        note="Shown truncated at the asset's fixed decimals, never rounded up. The exact value is one press away, in a popover, never in a title attribute. A signed figure has its sign and a word for screen readers."
      >
        <Example label="Plain, unit as a suffix">
          <Amount value="1,250.00" unit="USDx" />
        </Example>
        <Example label="With the exact value behind it: press">
          <Amount value="0.36" exact="0.3600001" unit="USDx" />
        </Example>
        <Example label="Gain and loss">
          <Amount value="0.42" unit="USDx" direction="gain" />
          <Amount value="0.36" unit="USDx" direction="loss" />
        </Example>
        <Example label="Serif figures">
          <Amount value="48.20" unit="USDx" figure="serif" size="lg" />
          <Amount value="8.20" exact="8.2000000" unit="USDx" figure="serif" direction="gain" />
        </Example>
      </Specimen>

      <Specimen
        title="Figure and unit"
        note="One rule, set in Amount: the unit is sans and muted, at UI size beside a serif figure and at label size beside a sans one. A figure never parts from its unit. Features keep no unit style of their own."
      >
        <Example label="Caption, 12 px">
          <span className="ui-caption">
            <Amount value="0.36" unit="USDx" />
          </span>
        </Example>
        <Example label="Table and interface, 13.5 px">
          <span className="ui-text">
            <Amount value="1,250.00" unit="USDx" />
          </span>
        </Example>
        <Example label="Figure, 16 px">
          <Amount value="1.80" unit="USDx" figure="serif" />
        </Example>
        <Example label="Large figure, 22 px">
          <Amount value="48.20" unit="USDx" figure="serif" size="lg" />
        </Example>
        <Example label="Under the highlighter">
          <Marker>
            <Amount value="10.00" unit="USDx" figure="serif" />
          </Marker>
        </Example>
      </Specimen>

      <Specimen title="Address and transaction" note="Proof is a truncated id in mono with a copy button and an explorer link. Short in tables, longer where a decision is taken, whole where it is checked.">
        <Example label="Short, 4 and 4, in tables">
          <Address value={SAMPLE_ADDRESS} explorerUrl={EXPLORER} />
        </Example>
        <Example label="With a known label, and your own account">
          <Address value={SAMPLE_ADDRESS} name="Maker A" explorerUrl={EXPLORER} copyLabel="Copy maker address" />
          <Address value={SAMPLE_CONTRACT} you copyLabel={null} />
        </Example>
        <Example label="Medium, 6 and 6, on decision surfaces">
          <Address value={SAMPLE_CONTRACT} length="medium" explorerUrl={EXPLORER} copyLabel="Copy contract id" />
        </Example>
        <Example label="Full, in groups of four, where it is checked character by character" wide>
          <Address value={SAMPLE_ADDRESS} length="full" />
        </Example>
        <Example label="Transaction">
          <TxLink hash={SAMPLE_HASH} explorerUrl={EXPLORER} copy />
          <TxLink hash={SAMPLE_HASH} />
        </Example>
      </Specimen>

      <Specimen title="Date, time and countdown" note="UTC is canonical: the contract compares against ledger close time. Local time is secondary. A countdown is driven by ledger time and truncates.">
        <Example label="Decision surfaces">
          <DateTime value={SAMPLE_DEADLINE} local="below" />
        </Example>
        <Example label="Inline">
          <DateTime value={SAMPLE_DEADLINE} local="inline" />
        </Example>
        <Example label="Table cell; the header says UTC">
          <DateTime value={SAMPLE_DEADLINE} format="table" />
        </Example>
        <Example label="Countdown: running, under the warning threshold, expired">
          <Countdown to={SAMPLE_DEADLINE} now={SAMPLE_NOW} />
          <Countdown to={SAMPLE_DEADLINE} now={SAMPLE_DEADLINE - 95 * 60_000} warnBelowMs={2 * 3_600_000} />
          <Countdown to={SAMPLE_DEADLINE} now={SAMPLE_DEADLINE + 1000} />
        </Example>
      </Specimen>
    </Section>
  )
}
