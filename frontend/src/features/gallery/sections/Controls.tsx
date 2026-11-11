import { useState } from 'react'
import {
  AmountField,
  Button,
  ButtonLink,
  Checkbox,
  ChoiceChips,
  Combobox,
  Glyph,
  IconButton,
  IconCalendarAdd,
  IconCopy,
  IconMore,
  IconRefresh,
  IconSearch,
  IconWallet,
  Link,
  RadioGroup,
  Segmented,
  Select,
  Slider,
  Switch,
  TextField,
} from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { EXPLORER, SAMPLE_ADDRESS } from './sample'

const ASSETS = [
  { value: 'BOND', label: 'BOND', detail: 'GCNW…FDGM' },
  { value: 'FUND', label: 'FUND', detail: 'GCNW…FDGM' },
  { value: 'EQTY', label: 'EQTY', detail: 'GCNW…FDGM' },
  { value: 'RWA', label: 'RWA', detail: 'GCNW…FDGM' },
]

export function ControlsSection() {
  const [loading, setLoading] = useState(false)
  const [qty, setQty] = useState('5')
  const [premium, setPremium] = useState('')
  const [address, setAddress] = useState(SAMPLE_ADDRESS)
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState<string | null>('13nov')
  const [asset, setAsset] = useState<string | null>('BOND')
  const [consent, setConsent] = useState(false)
  const [some, setSome] = useState(true)
  const [intent, setIntent] = useState('floor')
  const [mode, setMode] = useState('guided')
  const [kind, setKind] = useState('put')
  const [date, setDate] = useState('13')
  const [chipStrike, setChipStrike] = useState('99')
  const [chipDate, setChipDate] = useState('20')
  const [closed, setClosed] = useState(false)
  const [price, setPrice] = useState(9.2)

  return (
    <Section
      id="controls"
      title="Actions and forms"
      lead="Controls are 36 px tall (28 px in table rows) and grow to 44 px on touch screens. Borders hold 3:1. Buttons name the contract action: Buy, Write put, Exercise, Claim delivery."
    >
      <Specimen title="Button" note="One primary button per view, in ink. Secondary is outlined, quiet has no border, danger is for destructive actions.">
        <Example label="Variants, 36 px">
          <Button variant="primary">Buy put</Button>
          <Button variant="secondary">Write call</Button>
          <Button variant="quiet">Cancel</Button>
          <Button variant="danger">Claw back</Button>
        </Example>
        <Example label="Small, 28 px, for table rows">
          <Button variant="primary" size="sm">
            Buy
          </Button>
          <Button variant="secondary" size="sm">
            Exercise
          </Button>
          <Button variant="quiet" size="sm">
            Post a request
          </Button>
          <Button variant="danger" size="sm">
            Freeze
          </Button>
        </Example>
        <Example label="With an icon">
          <Button variant="secondary" iconStart={<IconWallet />}>
            Connect wallet
          </Button>
          <Button variant="quiet" iconStart={<IconCalendarAdd />}>
            Add to calendar
          </Button>
          <Button variant="secondary" iconStart={<Glyph name="long-put" />}>
            Set a floor
          </Button>
        </Example>
        <Example label="Disabled keeps its shape; the reason is a tooltip and is read out">
          <Button variant="primary" disabled disabledReason="Connect a wallet to buy.">
            Buy for 1.80 USDx
          </Button>
          <Button variant="secondary" disabled>
            Reclaim
          </Button>
          <Button variant="quiet" disabled>
            Cancel
          </Button>
        </Example>
        <Example label="Loading: the label is the state, focus stays on the button">
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 2400)
            }}
          >
            {loading ? 'Checking' : 'Buy for 1.80 USDx'}
          </Button>
          <Button variant="secondary" loading>
            Waiting for signature
          </Button>
        </Example>
        <Example label="A link that looks like a button stays a link">
          <ButtonLink variant="primary" href="#controls">
            Go to Markets
          </ButtonLink>
          <ButtonLink variant="secondary" href="#controls">
            View position
          </ButtonLink>
        </Example>
      </Specimen>

      <Specimen title="Icon button" note="Only where the icon replaces a word in a tight row. The label is required: it is the accessible name and the tooltip.">
        <IconButton label="Copy address" icon={<IconCopy />} />
        <IconButton label="Refresh balances" icon={<IconRefresh />} />
        <IconButton label="More actions" icon={<IconMore />} variant="secondary" />
        <IconButton label="Copy address" icon={<IconCopy />} size="sm" />
        <IconButton label="Refresh balances" icon={<IconRefresh />} disabled />
      </Specimen>

      <Specimen title="Link" note="Royal ink marks what can be followed. Outbound links say so, with an icon and for screen readers.">
        <Link href="#controls">Read the contract</Link>
        <Link href="#controls" tone="ink">
          How settlement works
        </Link>
        <Link href="#controls" tone="quiet">
          Design system
        </Link>
        <Link href={EXPLORER} external>
          View on stellar.expert
        </Link>
      </Specimen>

      <Specimen
        title="Amount field"
        note="Decimal strings only. A text input with a decimal keypad, never type=number: no float, no spinner. Validation comes from the caller's exact parser. 16 px on every screen."
        layout="split"
        surface
      >
        <AmountField
          label="Quantity"
          unit="BOND"
          decimals={7}
          value={qty}
          onValueChange={setQty}
          aside="Balance 12.50 BOND"
          onMax={() => setQty('12.5')}
          maxLabel="use the full balance, 12.50 BOND"
          validate={(v) => (/^0*\.?0*$/.test(v) ? 'Enter a quantity above 0.' : undefined)}
          hint="Up to 7 decimals. Clear it and leave the field to see the validation."
        />
        <AmountField label="Premium per BOND" unit="USDx" decimals={7} value={premium} onValueChange={setPremium} />
        <AmountField
          label="You pay"
          unit="USDx"
          value="1.80"
          onValueChange={() => {}}
          aside="Balance 1.20 USDx"
          error="You have 1.20 USDx; this needs 1.80 USDx. Get test funds or lower the quantity."
        />
        <AmountField label="Collateral locked" unit="USDx" value="50.00" onValueChange={() => {}} disabled hint="Strike times quantity." />
      </Specimen>

      <Specimen title="Text field" note="Label above, one hint below. Errors say the cause, the consequence and the fix, with an icon." layout="split" surface>
        <TextField label="Label for this account" value={name} onValueChange={setName} placeholder="Maker A" optional hint="Shown only in this browser." />
        <TextField
          label="Target address"
          mono
          value={address}
          onValueChange={setAddress}
          hint="Check the whole address, not only its ends."
        />
        <TextField
          label="Asset code"
          value="bond/x"
          onValueChange={() => {}}
          error="Codes are 1 to 12 letters or digits. Remove the slash."
        />
        <TextField label="Search assets" type="search" value="" onValueChange={() => {}} placeholder="Code or issuer" prefix={<IconSearch />} hideLabel />
      </Specimen>

      <Specimen title="Select and combobox" note="Select for a short known list. Combobox when the list is long enough to search." layout="split" surface>
        <Select
          label="Deadline"
          value={expiry}
          onValueChange={setExpiry}
          options={[
            { value: '13nov', label: '13 Nov 2026, 08:00 UTC', detail: '2 d' },
            { value: '20nov', label: '20 Nov 2026, 08:00 UTC', detail: '9 d' },
            { value: '27nov', label: '27 Nov 2026, 08:00 UTC', detail: '16 d' },
            { value: '25dec', label: '25 Dec 2026, 08:00 UTC', detail: '44 d' },
            { value: 'custom', label: 'Other dates', disabled: true },
          ]}
        />
        <Combobox label="Asset" value={asset} onValueChange={setAsset} items={ASSETS} placeholder="Code or issuer" emptyText="No listed asset matches." />
        <Select
          label="Sort"
          size="sm"
          value="premium"
          onValueChange={() => {}}
          options={[
            { value: 'premium', label: 'Lowest premium' },
            { value: 'expiry', label: 'Nearest deadline' },
          ]}
        />
        <Select label="Kind" value={null} onValueChange={() => {}} options={[{ value: 'put', label: 'Put' }]} placeholder="Choose a kind" error="Choose put or call." />
      </Specimen>

      <Specimen title="Checkbox" note="A consent gate carries the full sentence the user agrees to; it gates the action." layout="stack">
        <Checkbox checked={consent} onCheckedChange={setConsent} description="The action button stays disabled until this is ticked.">
          I want to exercise although the option is out of the money at the demo price.
        </Checkbox>
        <div className={styles.cluster}>
          <Checkbox checked={some} onCheckedChange={setSome}>
            Show reference assets only
          </Checkbox>
          <Checkbox checked={false} indeterminate onCheckedChange={() => {}}>
            Some rows selected
          </Checkbox>
          <Checkbox checked disabled onCheckedChange={() => {}}>
            Disabled, ticked
          </Checkbox>
          <Checkbox checked={false} disabled onCheckedChange={() => {}}>
            Disabled
          </Checkbox>
        </div>
      </Specimen>

      <Specimen title="Radio group" note="A few options that each need a sentence. Arrow keys move and select; Tab leaves the group." layout="split">
        <RadioGroup
          label="What do you want to do?"
          value={intent}
          onValueChange={setIntent}
          options={[
            { value: 'floor', label: 'Set a floor', description: 'You pay a premium for the right to sell at your price.' },
            { value: 'earn-hold', label: 'Earn on what you hold', description: 'You are paid a premium and may have to sell at your price.' },
            { value: 'earn-buy', label: 'Earn while waiting to buy', description: 'You are paid a premium and may have to buy at your price.' },
            { value: 'lock-buy', label: 'Lock a buy price', description: 'You pay a premium for the right to buy at your price.', disabled: true },
          ]}
        />
        <RadioGroup
          label="Kind"
          orientation="horizontal"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: 'put', label: 'Put' },
            { value: 'call', label: 'Call' },
          ]}
        />
      </Specimen>

      <Specimen
        title="Segmented"
        note="A real radio group for modes of the same view: one tab stop, arrow keys, the choice is announced as selected. Not for navigation."
      >
        <Example label="Mode switch">
          <Segmented
            label="Mode"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'guided', label: 'Guided' },
              { value: 'chain', label: 'Chain' },
            ]}
          />
        </Example>
        <Example label="With a second line: standard deadlines with days left">
          <Segmented
            label="Deadline"
            value={date}
            onValueChange={setDate}
            options={[
              { value: '13', label: '13 Nov', detail: '2 d' },
              { value: '20', label: '20 Nov', detail: '9 d' },
              { value: '27', label: '27 Nov', detail: '16 d' },
              { value: '25', label: '25 Dec', detail: '44 d' },
              { value: 'other', label: 'Other dates', disabled: true },
            ]}
          />
        </Example>
        <Example label="Small, with glyphs and a visible label">
          <Segmented
            label="Kind"
            showLabel
            size="sm"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'put', label: 'Put', icon: <Glyph name="long-put" /> },
              { value: 'call', label: 'Call', icon: <Glyph name="long-call" /> },
            ]}
          />
        </Example>
      </Specimen>

      <Specimen
        title="Choice chips"
        note="One choice among values that need more room than a strip, as on the guided note. The chosen chip takes the selection tint and an accent edge, never the primary fill; a tick marks a chip with a funded offer behind it."
      >
        <Example label="On a note: strikes, one chosen, two funded">
          <ChoiceChips
            appearance="note"
            label="Floor, per unit"
            value={chipStrike}
            onValueChange={setChipStrike}
            columns={5}
            chips={[
              { value: '97', label: '97.00', name: '97.00, funded', marked: true },
              { value: '98', label: '98.00' },
              { value: '99', label: '99.00', name: '99.00, funded', marked: true },
              { value: '100', label: '100.00' },
              { value: '101', label: '101.00' },
            ]}
          />
        </Example>
        <Example label="In a form: deadlines with days left">
          <ChoiceChips
            label="Deadline"
            value={chipDate}
            onValueChange={setChipDate}
            columns={4}
            chips={[
              { value: '13', label: '13 Nov', detail: '2 d' },
              { value: '20', label: '20 Nov', detail: '9 d' },
              { value: '27', label: '27 Nov', detail: '16 d' },
              { value: '25', label: '25 Dec', detail: '44 d' },
            ]}
          />
        </Example>
      </Specimen>

      <Specimen title="Switch" note="An immediate setting, named after the setting and not the state. The only pill in the system.">
        <Switch checked={closed} onCheckedChange={setClosed}>
          Show closed positions
        </Switch>
        <Switch checked={false} disabled onCheckedChange={() => {}}>
          Disabled
        </Switch>
        <Switch checked disabled onCheckedChange={() => {}}>
          Disabled, on
        </Switch>
      </Specimen>

      <Specimen
        title="Slider"
        note="For an assumed price in a hypothetical figure. Arrow keys step, Page Up and Page Down jump, the value is read as text. Never bound to an amount that gets signed."
        layout="split"
      >
        <Slider
          label="Assumed BOND price at the deadline"
          value={price}
          onValueChange={setPrice}
          min={8}
          max={12}
          step={0.05}
          largeStep={0.5}
          valueText={(v) => `${v.toFixed(2)} USDx per unit`}
          marks={[
            { value: 8, label: '8.00' },
            { value: 10, label: 'Floor 10.00' },
            { value: 12, label: '12.00' },
          ]}
          hint="An assumed price at the deadline."
        />
        <Slider label="Disabled" value={40} onValueChange={() => {}} min={0} max={100} disabled />
      </Specimen>
    </Section>
  )
}
