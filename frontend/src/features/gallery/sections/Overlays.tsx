import { useRef, useState } from 'react'
import { definitionOf } from '../../../core/glossary'
import {
  Amount,
  Button,
  Callout,
  Dialog,
  Drawer,
  IconActivity,
  IconButton,
  IconDisconnect,
  IconInfo,
  IconRefresh,
  IconSettings,
  KeyValue,
  KeyValueItem,
  Menu,
  MenuGroup,
  MenuItem,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  Popover,
  Sheet,
  Term,
  TextField,
  Tooltip,
  announce,
  toast,
} from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { CoachmarkSpecimen } from './CoachmarkSpecimen'
import { EXPLORER } from './sample'

type Open = null | 'title' | 'form' | 'confirm' | 'large' | 'drawer' | 'sheet'

export function OverlaysSection() {
  const [open, setOpen] = useState<Open>(null)
  const [typed, setTyped] = useState('')
  const [theme, setTheme] = useState('system')
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const close = () => setOpen(null)
  const onOpenChange = (next: boolean) => {
    if (!next) close()
  }

  return (
    <Section
      id="overlays"
      title="Overlays"
      lead="Dialogs, the drawer and the sheet trap focus, close on Escape and return focus to what opened them. Each takes a policy for where focus goes on open. Open them with the keyboard to check."
    >
      <Specimen title="Tooltip" note="A short label for an icon. Never essential: touch has no hover. The reason of a disabled button also opens on a tap, under the button.">
        <Tooltip content="Read at ledger 58,331,204">
          <Button variant="quiet">Hover or focus</Button>
        </Tooltip>
        <Tooltip content="Refresh balances" side="right">
          <IconButton label="Refresh balances" icon={<IconRefresh />} tooltip={false} />
        </Tooltip>
      </Specimen>

      <Specimen title="Popover" note="For an explanation or an exact value that someone asks for. Opened by its trigger, so it works with touch and keyboard.">
        <Popover trigger={<Button variant="secondary" iconStart={<IconInfo />}>What is a demo price?</Button>} title="Demo price">
          A fixed figure chosen by the team, used to place strikes and to label options as in or out of the money.
        </Popover>
        <Popover trigger={<Button variant="quiet">Open on the right</Button>} side="right" align="center">
          Popovers flip and shift to stay in view.
        </Popover>
      </Specimen>

      <Specimen title="Term" note="A term of the trade explained where it is met: the word is the button, a press opens its one glossary sentence. In place of a caption that defines its label.">
        <KeyValue className={styles.narrow}>
          <KeyValueItem label={<Term definition={definitionOf('breakeven')}>Breakeven</Term>}>
            <Amount value="98.32" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label={<Term definition={definitionOf('premium')}>Premium</Term>}>
            <Amount value="1.36" unit="USDx" figure="serif" />
          </KeyValueItem>
        </KeyValue>
      </Specimen>

      <CoachmarkSpecimen />

      <Specimen title="Menu" note="Actions on one object, or settings. Arrow keys move, typing jumps to an item, Escape closes and returns focus.">
        <Menu trigger={<Button variant="secondary">GAJ2…VC7G</Button>} align="start">
          <MenuItem icon={<IconRefresh />} detail="12.50 BOND" onSelect={() => toast({ title: 'Balances refreshed' })}>
            Refresh balances
          </MenuItem>
          <MenuLinkItem href="#overlays" icon={<IconActivity />}>
            Activity
          </MenuLinkItem>
          <MenuLinkItem href={EXPLORER} external>
            View account on the explorer
          </MenuLinkItem>
          <MenuSeparator />
          <MenuItem icon={<IconDisconnect />} tone="danger" onSelect={() => toast({ title: 'Wallet disconnected' })}>
            Disconnect
          </MenuItem>
        </Menu>
        <Menu trigger={<IconButton label="Display settings" icon={<IconSettings />} variant="secondary" />}>
          <MenuRadioGroup label="Theme" value={theme} onValueChange={setTheme}>
            <MenuRadioItem value="system">System</MenuRadioItem>
            <MenuRadioItem value="light">Light</MenuRadioItem>
            <MenuRadioItem value="dark">Dark</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuGroup label="Calendar">
            <MenuItem keepOpen>Download the deadline</MenuItem>
            <MenuItem keepOpen disabled>
              Add to Google Calendar
            </MenuItem>
          </MenuGroup>
        </Menu>
      </Specimen>

      <Specimen
        title="Dialog"
        note="One per flow, never stacked. Focus goes to the title by default, so reading starts at the top and nothing destructive is armed."
      >
        <Example label="Focus on the title (default)">
          <Button onClick={() => setOpen('title')}>Open a short dialog</Button>
        </Example>
        <Example label="Focus on the first control, for forms">
          <Button onClick={() => setOpen('form')}>Open a form</Button>
        </Example>
        <Example label="Typed confirmation: focus on Cancel, outside press does not close">
          <Button variant="danger" onClick={() => setOpen('confirm')}>
            Claw back
          </Button>
        </Example>
        <Example label="Large, with a scrolling body and a fixed footer">
          <Button onClick={() => setOpen('large')}>Open a long dialog</Button>
        </Example>
      </Specimen>

      <Specimen title="Drawer and sheet" note="The drawer carries the order ticket between 768 and 1199 px. The sheet is for short confirmations on phones; longer flows are pages.">
        <Example label="Right drawer, 420 px, swipe or Escape to close">
          <Button onClick={() => setOpen('drawer')}>Open the drawer</Button>
        </Example>
        <Example label="Bottom sheet">
          <Button onClick={() => setOpen('sheet')}>Open the sheet</Button>
        </Example>
      </Specimen>

      <Specimen
        title="Toasts and announcements"
        note="A toast only repeats something recorded elsewhere: the row, the receipt, the Activity list. Failures and toasts with an action stay until dismissed. Text reaches screen readers through the two permanent live regions."
      >
        <Example label="Toasts">
          <Button variant="secondary" onClick={() => toast({ title: 'Address copied' })}>
            Neutral
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: 'Offer cancelled', description: 'Your 50.00 USDx collateral is back in your wallet.', tone: 'success' })}>
            Success
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Deadline in 2 h', description: 'Long put on BOND, in the money at the demo price.', tone: 'warning', action: { label: 'View position', onClick: () => {} } })}
          >
            Warning with an action
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Not sent', description: 'The BOND issuer has not authorized your account. Nothing was sent.', tone: 'danger' })}
          >
            Failure
          </Button>
        </Example>
        <Example label="Announce without a toast">
          <Button variant="quiet" onClick={() => announce('Pending. The transaction was sent and is waiting for a ledger.')}>
            Polite
          </Button>
          <Button variant="quiet" onClick={() => announce('Failed. The network fee was charged.', 'assertive')}>
            Assertive
          </Button>
        </Example>
      </Specimen>

      <Dialog
        open={open === 'title'}
        onOpenChange={onOpenChange}
        size="sm"
        title="Exercise this put?"
        description="You deliver 5.00 BOND and receive 50.00 USDx in one transaction."
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={close}>
              Exercise
            </Button>
          </>
        }
      />

      <Dialog
        open={open === 'form'}
        onOpenChange={onOpenChange}
        size="sm"
        initialFocus="first-control"
        title="Label this account"
        description="The label is kept in this browser only."
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={close}>
              Save label
            </Button>
          </>
        }
      >
        <TextField label="Label" value={typed} onValueChange={setTyped} placeholder="Maker A" />
      </Dialog>

      <Dialog
        open={open === 'confirm'}
        onOpenChange={onOpenChange}
        size="sm"
        role="alertdialog"
        dismissible={false}
        initialFocus={cancelRef}
        title="Claw back 5.00 BOND"
        description="This removes 5.00 BOND from GAJ2…VC7G and can leave options on BOND without their collateral."
        footer={
          <>
            <Button variant="quiet" ref={cancelRef} onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" disabled={typed !== 'BOND'} disabledReason="Type BOND to confirm." onClick={close}>
              Claw back 5.00 BOND
            </Button>
          </>
        }
      >
        <TextField label="Type BOND to confirm" value={typed} onValueChange={setTyped} autoComplete="off" />
      </Dialog>

      <Dialog
        open={open === 'large'}
        onOpenChange={onOpenChange}
        size="lg"
        title="Contracts and roles"
        description="What each contract is, who can call what, and what nobody can do."
        footer={
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        }
      >
        <Callout variant="info" title="The body scrolls; the title and the actions stay in view." />
        {Array.from({ length: 6 }, (_, i) => (
          <KeyValue key={i} figures="sans">
            <KeyValueItem label="Contract">Covered, version 1.5</KeyValueItem>
            <KeyValueItem label="Admin key">None</KeyValueItem>
            <KeyValueItem label="Upgrade path">None</KeyValueItem>
            <KeyValueItem label="Listing an asset">Anyone, by code and issuer</KeyValueItem>
          </KeyValue>
        ))}
      </Dialog>

      <Drawer
        open={open === 'drawer'}
        onOpenChange={onOpenChange}
        title="Buy put, BOND"
        description="The order ticket lives here on medium screens."
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={close}>
              Review
            </Button>
          </>
        }
      >
        <KeyValue>
          <KeyValueItem label="Strike" marked>
            <Amount value="10.00" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Quantity">
            <Amount value="5.00" unit="BOND" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="You pay">
            <Amount value="1.80" unit="USDx" figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Breakeven">
            <Amount value="9.64" unit="USDx" figure="serif" />
          </KeyValueItem>
        </KeyValue>
      </Drawer>

      <Sheet
        open={open === 'sheet'}
        onOpenChange={onOpenChange}
        title="Cancel this offer?"
        description="Your 50.00 USDx collateral returns to your wallet. The offer leaves the book."
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Keep the offer
            </Button>
            <Button variant="primary" onClick={close}>
              Cancel offer
            </Button>
          </>
        }
      />
    </Section>
  )
}
