import { useState } from 'react'
import type { ReactNode } from 'react'
import { BulletRow } from './BulletRow.tsx'
import { formatNumber, formatSigned } from './format.ts'
import { samplePiecewise } from './geometry.ts'
import { HealthBar } from './HealthBar.tsx'
import { OutcomeCards, ScenarioBar } from './OutcomeCards.tsx'
import { PayoffChart } from './PayoffChart.tsx'
import { priceDomain } from './scales.ts'
import { Sparkline } from './Sparkline.tsx'
import { TimelineDots } from './TimelineDots.tsx'
import { Waterfall } from './Waterfall.tsx'
import { WithWithoutChart } from './WithWithoutChart.tsx'
import css from './Gallery.module.css'

// Demo figures only. In the app the payoff comes from packages/payoff and every amount from exact integers;
// here a few closed forms stand in so the gallery has no dependency outside this folder.
const CAPTION = 'Hypothetical payoff at expiry. Not a quote.'
const longPut = (qty: number, strike: number, premium: number) => (s: number) => qty * Math.max(strike - s, 0) - premium
const longCall = (qty: number, strike: number, premium: number) => (s: number) => qty * Math.max(s - strike, 0) - premium
const shortPut = (qty: number, strike: number, premium: number) => (s: number) => premium - qty * Math.max(strike - s, 0)
const shortCall = (qty: number, strike: number, premium: number) => (s: number) => premium - qty * Math.max(s - strike, 0)

function Specimen({ title, note, children, width, wide }: { title: string; note?: ReactNode; children: ReactNode; width?: number; wide?: boolean }) {
  return (
    <section className={css.specimen} data-wide={wide ? 'true' : undefined} style={width ? { width, maxWidth: '100%' } : undefined}>
      <header className={css.specimenHead}>
        <h3 className={css.specimenTitle}>{title}</h3>
        {note && <p className={css.note}>{note}</p>}
      </header>
      {children}
    </section>
  )
}

function Group({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <section className={css.group}>
      <h2 className={css.groupTitle}>{title}</h2>
      <p className={css.lede}>{lede}</p>
      <div className={css.grid}>{children}</div>
    </section>
  )
}

function PutPayoff() {
  const domain = priceDomain({ center: 9.82, include: [10, 9.64] })
  return (
    <PayoffChart
      title="Payoff at expiry, long put on 5.00 BOND"
      points={samplePiecewise(longPut(5, 10, 1.8), domain, [10])}
      domain={domain}
      strike={{ value: 10, label: '10.00' }}
      breakevens={[{ value: 9.64, label: '9.64' }]}
      reference={{ value: 9.82, label: 'Demo price 9.82' }}
      maxGain={{ value: 48.2, label: '48.20', at: 0 }}
      maxLoss={{ value: 1.8, label: '1.80' }}
      defaultPrice={8}
      unit="USDx"
      asset="BOND"
      caption={CAPTION}
    />
  )
}

function CallPayoff() {
  const domain = priceDomain({ center: 118.4, include: [120, 124.5] })
  return (
    <PayoffChart
      title="Payoff at expiry, long call on 2.00 EQTY"
      points={samplePiecewise(longCall(2, 120, 9), domain, [120])}
      domain={domain}
      strike={{ value: 120, label: '120.00' }}
      breakevens={[{ value: 124.5, label: '124.50' }]}
      reference={{ value: 118.4, label: 'Demo price 118.40' }}
      maxGain={{ value: Infinity }}
      maxLoss={{ value: 9, label: '9.00' }}
      defaultPrice={140}
      unit="USDx"
      asset="EQTY"
      caption={CAPTION}
    />
  )
}

function WriterPayoff() {
  const domain = priceDomain({ center: 10, include: [9.5, 9.14] })
  return (
    <PayoffChart
      title="Payoff at expiry, put written on 5.00 BOND"
      points={samplePiecewise(shortPut(5, 9.5, 1.8), domain, [9.5])}
      domain={domain}
      strike={{ value: 9.5, label: '9.50' }}
      breakevens={[{ value: 9.14, label: '9.14' }]}
      reference={{ value: 10, label: 'Testnet faucet price 10.00' }}
      maxGain={{ value: 1.8, label: '1.80' }}
      maxLoss={{ value: 45.7, label: '45.70', at: 0 }}
      defaultPrice={10}
      unit="USDx"
      asset="BOND"
      caption={CAPTION}
    />
  )
}

function ProtectivePut({ price, onPriceChange }: { price?: number; onPriceChange?: (p: number) => void }) {
  const domain: [number, number] = [6, 14]
  return (
    <WithWithoutChart
      title="Value of 5.00 BOND at the deadline, with and without a put at 10.00"
      points={samplePiecewise((s) => 5 * Math.max(s, 10) - 1.8, domain, [10]).map((p) => ({ x: p.x, with: p.y, without: 5 * p.x }))}
      domain={domain}
      level={{ value: 10, label: 'Floor 10.00' }}
      reference={{ value: 9.82, label: 'Demo price 9.82' }}
      withLabel="With the put"
      withoutLabel="Without"
      price={price}
      defaultPrice={8}
      onPriceChange={onPriceChange}
      unit="USDx"
      asset="BOND"
      caption={CAPTION}
    />
  )
}

function CoveredCall() {
  const domain: [number, number] = [6, 14]
  return (
    <WithWithoutChart
      title="Value of 5.00 BOND at the deadline, with and without a call written at 11.00"
      points={samplePiecewise((s) => 5 * Math.min(s, 11) + 2.1, domain, [11]).map((p) => ({ x: p.x, with: p.y, without: 5 * p.x }))}
      domain={domain}
      level={{ value: 11, label: 'Cap 11.00' }}
      reference={{ value: 10, label: 'Testnet faucet price 10.00' }}
      withLabel="With the call written"
      withoutLabel="Without"
      defaultPrice={12.5}
      unit="USDx"
      asset="BOND"
      caption={CAPTION}
    />
  )
}

function GuidedOutcome() {
  const [price, setPrice] = useState(8)
  const scenarios = [
    { id: 'low', price: 8, label: 'If BOND falls to 8.00', sentence: 'You exercise: you deliver 5.00 BOND and receive 50.00 USDx.' },
    { id: 'ref', price: 9.82, label: 'If BOND stays at 9.82', sentence: 'You exercise: 10.00 is above 9.82. The premium costs more than the put brings.' },
    { id: 'high', price: 12, label: 'If BOND rises to 12.00', sentence: 'You let the put expire and keep 5.00 BOND. The 1.80 USDx premium is spent.' },
  ]
  return (
    <div className={css.stack}>
      <ProtectivePut price={price} onPriceChange={setPrice} />
      <OutcomeCards
        label="Three outcomes at the deadline"
        onSelect={(id) => setPrice(scenarios.find((s) => s.id === id)?.price ?? price)}
        barKey={{ value: 'With the put', compare: 'Without' }}
        outcomes={scenarios.map((s) => {
          const withValue = 5 * Math.max(s.price, 10) - 1.8
          const without = 5 * s.price
          return {
            id: s.id,
            label: s.label,
            figure: formatNumber(withValue),
            unit: 'USDx',
            delta: { value: withValue - without, text: `${formatSigned(withValue - without)} against holding alone` },
            sentence: s.sentence,
            bar: { value: withValue, compare: without },
            current: Math.abs(price - s.price) < 1e-9,
          }
        })}
      />
    </div>
  )
}

const WALK = [10, 10.02, 9.97, 9.91, 9.95, 10.06, 10.11, 10.04, 9.99, 10.08, 10.17, 10.21, 10.14, 10.19, 10.26, 10.22, 10.3]

/** Every chart of the kit with realistic figures and the edge cases it must survive. Mounted at /viz.html and reusable in the design gallery. */
export default function Gallery() {
  return (
    <div className={css.gallery}>
      <Group title="Payoff at expiry" lede="One position. Ink line, gain tinted, loss hatched, the strike as a dotted rule, the breakeven as an open circle, the reference price as an ink tick. Drag the flag, click the plot, or use the arrow keys.">
        <Specimen title="Long put" note="5.00 BOND, strike 10.00, premium 1.80 USDx. The largest gain is off the chart, and the label says where.">
          <PutPayoff />
        </Specimen>
        <Specimen title="Long call" note="2.00 EQTY, strike 120.00, premium 9.00 USDx. No upper limit to the gain.">
          <CallPayoff />
        </Specimen>
        <Specimen title="Put written (cash secured)" note="The writer keeps the premium at most and can lose the strike less the premium.">
          <WriterPayoff />
        </Specimen>
      </Group>

      <Group title="Payoff edge cases" lede="The figure has to stay legible when the numbers are not friendly.">
        <Specimen title="Zero premium" note="The breakeven is the strike: one label for both, no loss area.">
          <PayoffChart
            title="Payoff at expiry, long put with no premium"
            points={samplePiecewise(longPut(5, 10, 0), [6, 14], [10])}
            domain={[6, 14]}
            strike={{ value: 10, label: '10.00' }}
            breakevens={[{ value: 10, label: '10.00' }]}
            reference={{ value: 10, label: 'Testnet faucet price 10.00' }}
            maxGain={{ value: 50, label: '50.00', at: 0 }}
            maxLoss={{ value: 0, label: '0.00' }}
            defaultPrice={9}
            unit="USDx"
            asset="BOND"
            caption={CAPTION}
          />
        </Specimen>
        <Specimen title="Deep in the money" note="Put at 16.00 with the reference at 10.00. The range widens to keep the strike in view.">
          {(() => {
            const domain = priceDomain({ center: 10, include: [16, 15.2] })
            return (
              <PayoffChart
                title="Payoff at expiry, put deep in the money"
                points={samplePiecewise(longPut(5, 16, 4), domain, [16])}
                domain={domain}
                strike={{ value: 16, label: '16.00' }}
                breakevens={[{ value: 15.2, label: '15.20' }]}
                reference={{ value: 10, label: 'Demo price 10.00' }}
                maxGain={{ value: 76, label: '76.00', at: 0 }}
                maxLoss={{ value: 4, label: '4.00' }}
                defaultPrice={10}
                unit="USDx"
                asset="BOND"
                caption={CAPTION}
              />
            )
          })()}
        </Specimen>
        <Specimen title="Deep out of the money" note="Call at 20.00 with the reference at 10.00: the whole visible line is the premium lost.">
          <PayoffChart
            title="Payoff at expiry, call far out of the money"
            points={samplePiecewise(longCall(5, 20, 0.6), [6, 14], [20])}
            domain={[6, 14]}
            strike={{ value: 20, label: '20.00' }}
            breakevens={[]}
            reference={{ value: 10, label: 'Demo price 10.00' }}
            maxGain={{ value: Infinity }}
            maxLoss={{ value: 0.6, label: '0.60' }}
            defaultPrice={10}
            unit="USDx"
            asset="BOND"
            caption={CAPTION}
          />
        </Specimen>
        <Specimen title="No limit to the loss" note="An uncovered call written in Margin: the premium is the most the writer gains, and the loss has no upper limit.">
          {(() => {
            const domain = priceDomain({ center: 128, include: [110, 114.2] })
            return (
              <PayoffChart
                title="Payoff at expiry, uncovered call written on 10.00 EQTY"
                points={samplePiecewise(shortCall(10, 110, 42), domain, [110])}
                domain={domain}
                strike={{ value: 110, label: '110.00' }}
                breakevens={[{ value: 114.2, label: '114.20' }]}
                reference={{ value: 128, label: 'Publisher price 128.00' }}
                maxGain={{ value: 42, label: '42.00' }}
                maxLoss={{ value: Infinity }}
                defaultPrice={128}
                unit="USDx"
                asset="EQTY"
                caption={CAPTION}
              />
            )
          })()}
        </Specimen>
        <Specimen title="Very small prices" note="A token quoted at 0.00012 USDx. Decimals follow the range of the axis.">
          <PayoffChart
            title="Payoff at expiry, put on a low-priced token"
            points={samplePiecewise(longPut(1_000_000, 0.00012, 6), [0.00007, 0.00017], [0.00012])}
            domain={[0.00007, 0.00017]}
            strike={{ value: 0.00012, label: '0.00012' }}
            breakevens={[{ value: 0.000114, label: '0.000114' }]}
            reference={{ value: 0.000118, label: 'Demo price 0.000118' }}
            maxGain={{ value: 114, label: '114.00', at: 0 }}
            maxLoss={{ value: 6, label: '6.00' }}
            defaultPrice={0.0001}
            unit="USDx"
            asset="MICRO"
            caption={CAPTION}
          />
        </Specimen>
        <Specimen title="Very large amounts" note="250 units at a strike of 1,250,000. Axis ends are compact; amounts in labels stay exact.">
          <PayoffChart
            title="Payoff at expiry, call on a high-priced token"
            points={samplePiecewise(longCall(250, 1_250_000, 12_500_000), [750_000, 1_750_000], [1_250_000])}
            domain={[750_000, 1_750_000]}
            strike={{ value: 1_250_000, label: '1,250,000' }}
            breakevens={[{ value: 1_300_000, label: '1,300,000' }]}
            reference={{ value: 1_180_000, label: 'Demo price 1,180,000' }}
            maxGain={{ value: Infinity }}
            maxLoss={{ value: 12_500_000, label: '12,500,000.00' }}
            defaultPrice={1_500_000}
            unit="USDx"
            asset="BIG"
            caption={CAPTION}
          />
        </Specimen>
        <Specimen title="Closed position" note="Read only: the price at which it was exercised is marked, and there is no handle.">
          <PayoffChart
            title="Payoff at expiry, put exercised at 8.40"
            points={samplePiecewise(longPut(5, 10, 1.8), [6, 14], [10])}
            domain={[6, 14]}
            strike={{ value: 10, label: '10.00' }}
            breakevens={[{ value: 9.64, label: '9.64' }]}
            maxLoss={{ value: 1.8, label: '1.80' }}
            price={8.4}
            readOnly
            readout={<p className={css.note}>Exercised at 8.40: +6.20 USDx against the premium paid.</p>}
            unit="USDx"
            asset="BOND"
            caption={CAPTION}
          />
        </Specimen>
        <Specimen title="320 px container" note="The narrowest ticket. Labels shorten or drop by priority; none overlaps." width={320}>
          <PutPayoff />
        </Specimen>
        <Specimen title="With its table shown" note="The same points as text. Hidden visually by default, always present for screen readers.">
          <PayoffChart
            title="Payoff at expiry, long put on 5.00 BOND"
            points={samplePiecewise(longPut(5, 10, 1.8), [6, 14], [10])}
            domain={[6, 14]}
            strike={{ value: 10, label: '10.00' }}
            breakevens={[{ value: 9.64, label: '9.64' }]}
            maxGain={{ value: 48.2, label: '48.20', at: 0 }}
            maxLoss={{ value: 1.8, label: '1.80' }}
            defaultPrice={9}
            unit="USDx"
            asset="BOND"
            caption={CAPTION}
            height={180}
            tableVisible
          />
        </Specimen>
      </Group>

      <Group title="With and without" lede="The guided figure: what the holding is worth at the deadline with the option (solid) and without it (dashed). Tinted where the option leaves more, hatched where it costs.">
        <Specimen title="Set a floor" note="5.00 BOND and a put at 10.00 for 1.80 USDx. Selecting a scenario moves the handle." wide>
          <GuidedOutcome />
        </Specimen>
        <Specimen title="Earn on what you hold" note="5.00 BOND with a call written at 11.00 for 2.10 USDx: more below the cap, less above it.">
          <CoveredCall />
        </Specimen>
        <Specimen title="320 px container" width={320}>
          <ProtectivePut />
        </Specimen>
      </Group>

      <Group title="Outcome cards and scenario bar" lede="Three scenarios with a serif figure, the difference in words, a sentence and a small bar on a shared scale.">
        <Specimen title="Static cards" note="Without a handler the cards are plain text. Three columns when the container allows, stacked otherwise." wide>
          <OutcomeCards
            barKey={{ value: 'With the call written', compare: 'Without' }}
            outcomes={[
              { id: 'low', label: 'If BOND falls to 8.00', figure: '42.10', unit: 'USDx', delta: { value: 2.1, text: '+2.10 against holding alone' }, sentence: 'The call expires. You keep 5.00 BOND and the 2.10 USDx premium.', bar: { value: 42.1, compare: 40 } },
              { id: 'ref', label: 'If BOND stays at 10.00', figure: '52.10', unit: 'USDx', delta: { value: 2.1, text: '+2.10 against holding alone' }, sentence: 'The call expires. You keep 5.00 BOND and the premium.', bar: { value: 52.1, compare: 50 }, current: true },
              { id: 'high', label: 'If BOND rises to 14.00', figure: '57.10', unit: 'USDx', delta: { value: -12.9, text: `${formatSigned(-12.9)} against holding alone` }, sentence: 'The buyer exercises: you deliver 5.00 BOND for 55.00 USDx and give up the rise above 11.00.', bar: { value: 57.1, compare: 70 } },
            ]}
          />
        </Specimen>
        <Specimen title="Scenario bar alone" note="Bar: with the option. Tick: without. Past the tick is what the option adds; a hatched stretch is what it costs.">
          <div className={css.stack}>
            <ScenarioBar value={48.2} compare={40} max={70} label="With the put 48.20 USDx, without 40.00 USDx" />
            <ScenarioBar value={48.2} compare={49.1} max={70} label="With the put 48.20 USDx, without 49.10 USDx" />
            <ScenarioBar value={58.2} compare={60} max={70} label="With the put 58.20 USDx, without 60.00 USDx" />
            <ScenarioBar value={0} compare={12} max={70} label="With 0.00 USDx, without 12.00 USDx" />
            <ScenarioBar value={36} max={70} label="36.00 USDx, nothing to compare with" />
          </div>
        </Specimen>
      </Group>

      <Group title="Margin health" lede="Account value against the liquidation and opening requirements. The liquidation zone is hatched and every state has a word. There is no zone that says an account is fine.">
        <Specimen title="Liquidatable">
          <HealthBar
            nlv={23_507.59}
            mm={43_945.44}
            im={54_931.8}
            nlvLabel="Account value 23,507.59"
            mmLabel="Liquidation (MM) 43,945.44"
            imLabel="Opening (IM) 54,931.80"
            mmShortLabel="MM 43,945.44"
            imShortLabel="IM 54,931.80"
            status="20,437.85 USDx below the liquidation level. Deposit 20,437.85 USDx to restore."
          />
        </Specimen>
        <Specimen title="Between the two requirements">
          <HealthBar
            nlv={48_120}
            mm={43_945.44}
            im={54_931.8}
            nlvLabel="Account value 48,120.00"
            mmLabel="Liquidation (MM) 43,945.44"
            imLabel="Opening (IM) 54,931.80"
            mmShortLabel="MM 43,945.44"
            imShortLabel="IM 54,931.80"
            status="4,174.56 USDx above the liquidation level (9.4 %). New positions need 6,811.80 USDx more."
          />
        </Specimen>
        <Specimen title="Above the opening requirement">
          <HealthBar
            nlv={56_355.44}
            mm={43_945.44}
            im={54_931.8}
            nlvLabel="Account value 56,355.44"
            mmLabel="Liquidation (MM) 43,945.44"
            imLabel="Opening (IM) 54,931.80"
            mmShortLabel="MM 43,945.44"
            imShortLabel="IM 54,931.80"
            status="12,410.00 USDx above the liquidation level (28.2 %)."
          />
        </Specimen>
        <Specimen title="No position, small account" note="Requirements of zero: both ticks sit at the origin and the labels stack.">
          <HealthBar nlv={120} mm={0} im={0} nlvLabel="Account value 120.00" mmLabel="Liquidation (MM) 0.00" imLabel="Opening (IM) 0.00" mmShortLabel="MM 0.00" imShortLabel="IM 0.00" status="No open position." />
        </Specimen>
        <Specimen title="Requirement unavailable">
          <HealthBar nlv={Number.NaN} mm={Number.NaN} im={Number.NaN} nlvLabel="Account value unknown" mmLabel="Liquidation (MM) unknown" imLabel="Opening (IM) unknown" status="The contract view did not answer. Nothing is assumed." />
        </Specimen>
        <Specimen title="320 px container" width={320}>
          <HealthBar
            nlv={23_507.59}
            mm={43_945.44}
            im={54_931.8}
            nlvLabel="Account value 23,507.59"
            mmLabel="Liquidation (MM) 43,945.44"
            imLabel="Opening (IM) 54,931.80"
            mmShortLabel="MM 43,945.44"
            imShortLabel="IM 54,931.80"
            status="20,437.85 USDx below the liquidation level."
          />
        </Specimen>
        <Specimen title="Compact, in a table" note="A 64 px meter for desk tables. The cell text carries the figures.">
          <table className={css.table}>
            <thead>
              <tr>
                <th scope="col">Writer</th>
                <th scope="col">Account value</th>
                <th scope="col">Health</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">GAJ2…VC7G</th>
                <td>23,507.59</td>
                <td>
                  <HealthBar variant="compact" nlv={23_507.59} mm={43_945.44} im={54_931.8} nlvLabel="Account value 23,507.59" mmLabel="Liquidation 43,945.44" imLabel="Opening 54,931.80" />
                </td>
                <td>Liquidatable</td>
              </tr>
              <tr>
                <th scope="row">GC7Z…5NAY</th>
                <td>48,120.00</td>
                <td>
                  <HealthBar variant="compact" nlv={48_120} mm={43_945.44} im={54_931.8} nlvLabel="Account value 48,120.00" mmLabel="Liquidation 43,945.44" imLabel="Opening 54,931.80" />
                </td>
                <td>Below opening margin</td>
              </tr>
              <tr>
                <th scope="row">GB4D…UUCF</th>
                <td>56,355.44</td>
                <td>
                  <HealthBar variant="compact" nlv={56_355.44} mm={43_945.44} im={54_931.8} nlvLabel="Account value 56,355.44" mmLabel="Liquidation 43,945.44" imLabel="Opening 54,931.80" />
                </td>
                <td>Above opening margin</td>
              </tr>
            </tbody>
          </table>
        </Specimen>
      </Group>

      <Group title="Payout waterfall" lede="Where a Margin payout comes from, in order: the writer's margin, then the vault, and what is left is a deficit, hatched.">
        <Specimen title="Paid in part" note="10 × (145.00 − 100.00) owed. The deficit is a reduced payout for the holder.">
          <Waterfall
            heading="Owed 450.00 USDx"
            paidLabel="Paid 400.00 of 450.00"
            segments={[
              { id: 'margin', label: 'Writer margin', value: 300, valueLabel: '300.00' },
              { id: 'vault', label: 'Vault', value: 100, valueLabel: '100.00' },
              { id: 'deficit', label: 'Deficit', value: 50, valueLabel: '50.00', kind: 'deficit' },
            ]}
          />
        </Specimen>
        <Specimen title="Paid from margin alone">
          <Waterfall
            heading="Owed 120.00 USDx"
            segments={[
              { id: 'margin', label: 'Writer margin', value: 120, valueLabel: '120.00' },
              { id: 'vault', label: 'Vault', value: 0, valueLabel: '0.00' },
              { id: 'deficit', label: 'Deficit', value: 0, valueLabel: '0.00', kind: 'deficit' },
            ]}
          />
        </Specimen>
        <Specimen title="Sliver of vault, large deficit" note="A 0.5 % segment keeps its 2 px gap and its label under the bar.">
          <Waterfall
            heading="Owed 1,284,500.00 USDx"
            paidLabel="Paid 384,500.00 of 1,284,500.00"
            segments={[
              { id: 'margin', label: 'Writer margin', value: 378_000, valueLabel: '378,000.00' },
              { id: 'vault', label: 'Vault', value: 6_500, valueLabel: '6,500.00' },
              { id: 'deficit', label: 'Deficit', value: 900_000, valueLabel: '900,000.00', kind: 'deficit' },
            ]}
          />
        </Specimen>
        <Specimen title="Nothing owed">
          <Waterfall
            heading="Owed 0.00 USDx (out of the money)"
            segments={[
              { id: 'margin', label: 'Writer margin', value: 0, valueLabel: '0.00' },
              { id: 'vault', label: 'Vault', value: 0, valueLabel: '0.00' },
              { id: 'deficit', label: 'Deficit', value: 0, valueLabel: '0.00', kind: 'deficit' },
            ]}
          />
        </Specimen>
        <Specimen title="320 px container" note="The labels no longer fit on one row and stack as a list." width={320}>
          <Waterfall
            heading="Owed 450.00 USDx"
            paidLabel="Paid 400.00 of 450.00"
            segments={[
              { id: 'margin', label: 'Writer margin', value: 300, valueLabel: '300.00' },
              { id: 'vault', label: 'Vault', value: 100, valueLabel: '100.00' },
              { id: 'deficit', label: 'Deficit', value: 50, valueLabel: '50.00', kind: 'deficit' },
            ]}
          />
        </Specimen>
      </Group>

      <Group title="Reserves" lede="Per token: what the contract holds (bar) against what open options require (tick), with the exact difference. A shortfall is hatched and named.">
        <Specimen title="Three tokens" note="Each row on its own scale. Nothing here calls a reserve backed: it shows two numbers and their difference." wide>
          <div className={css.rows}>
            <BulletRow name="USDx" locked={1080} held={1080} heldLabel="Held 1,080.00" lockedLabel="Locked 1,080.00" differenceLabel="0.00" />
            <BulletRow name="BOND" locked={3} held={3.4} heldLabel="Held 3.40" lockedLabel="Locked 3.00" differenceLabel="+0.40" />
            <BulletRow name="RWA" locked={250} held={230} heldLabel="Held 230.00" lockedLabel="Locked 250.00" differenceLabel={`${formatSigned(-20)}`} />
            <BulletRow name="EQTY" locked={0} held={0} heldLabel="Held 0.00" lockedLabel="Locked 0.00" differenceLabel="0.00" />
          </div>
        </Specimen>
        <Specimen title="320 px container" width={320}>
          <div className={css.rows}>
            <BulletRow name="USDx" locked={1_250_000} held={1_250_000.5} heldLabel="Held 1,250,000.50" lockedLabel="Locked 1,250,000.00" differenceLabel="+0.50" />
            <BulletRow name="RWA" locked={250} held={12} heldLabel="Held 12.00" lockedLabel="Locked 250.00" differenceLabel={`${formatSigned(-238)}`} />
          </div>
        </Specimen>
      </Group>

      <Group title="Sparkline" lede="Context beside a figure: a plain line with a dot on the last value. The summary for screen readers carries start, end, low and high.">
        <Specimen title="With the last value and a level">
          <div className={css.stack}>
            <Sparkline values={WALK} label="BOND demo price, 16 steps" lastLabel="10.30" rule={10} />
            <p className={css.note}>Dotted level: strike 10.00.</p>
          </div>
        </Specimen>
        <Specimen title="Inline, flat, one value, none">
          <div className={css.sparkRow}>
            <span>Rising</span>
            <Sparkline values={[1, 1.4, 1.2, 1.9, 2.4, 2.2, 3.1]} label="Rising series" height={24} />
            <span>Fixed rate</span>
            <Sparkline values={[10, 10, 10, 10, 10]} label="Testnet faucet price, fixed" height={24} lastLabel="10.00" />
            <span>One value</span>
            <Sparkline values={[10]} label="Single observation" height={24} />
            <span>No data</span>
            <Sparkline values={[]} label="No observations" height={24} />
          </div>
        </Specimen>
      </Group>

      <Group title="Lifecycle dots" lede="Steps on a rule: filled for done, a ringed dot for now, open for what is still to come. In a row when there is room, in a column otherwise.">
        <Specimen title="Holder of a put" note="Nothing settles by itself: the holder acts before the deadline." wide>
          <TimelineDots
            label="Lifecycle of this option"
            steps={[
              { id: 'offer', label: 'Offer funded', detail: 'Maker locked 50.00 USDx', state: 'done' },
              { id: 'buy', label: 'Bought', detail: 'You paid 1.80 USDx', state: 'done' },
              { id: 'exercise', label: 'Exercise or let it expire', detail: 'You, before 13 Nov 2026, 08:00 UTC', state: 'current' },
              { id: 'claim', label: 'Writer claims', detail: 'Delivery or collateral, after the deadline', state: 'upcoming' },
            ]}
          />
        </Specimen>
        <Specimen title="Column" width={320}>
          <TimelineDots
            label="Lifecycle of this option"
            orientation="vertical"
            steps={[
              { id: 'offer', label: 'Offer funded', detail: 'Maker locked 50.00 USDx', state: 'done' },
              { id: 'buy', label: 'Bought', detail: 'You paid 1.80 USDx', state: 'done' },
              { id: 'exercise', label: 'Exercise or let it expire', detail: 'You, before 13 Nov 2026, 08:00 UTC', state: 'current' },
              { id: 'claim', label: 'Writer claims', detail: 'Delivery or collateral, after the deadline', state: 'upcoming' },
            ]}
          />
        </Specimen>
      </Group>
    </div>
  )
}
