import { useState } from 'react'
import {
  Address,
  Button,
  EmptyNote,
  Glyph,
  IconBack,
  Link,
  NavTab,
  NavTabs,
  PageHeader,
  Segmented,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { EXPLORER, SAMPLE_ADDRESS } from './sample'

export function NavigationSection() {
  const [tab, setTab] = useState('holding')
  const [page, setPage] = useState('account')
  const [mode, setMode] = useState('guided')
  return (
    <Section
      id="navigation"
      title="Navigation"
      lead="Three things look alike and are not: tabs swap panels inside a page, navigation tabs are links between pages, and a segmented control changes the mode of one view. Each has its own keyboard model."
    >
      <Specimen title="Page header" note="One h1 in the serif, at most one line under it and one row of actions. No hero, no eyebrow. Focus lands on the heading after a route change. (This specimen is set a level down, so the page keeps its one h1.)" layout="stack" surface>
        <PageHeader
          headingLevel={4}
          back={
            <Link href="#navigation" tone="quiet">
              <IconBack size={14} style={{ display: 'inline', verticalAlign: '-0.12em', marginInlineEnd: 4 }} />
              Markets
            </Link>
          }
          title="BOND"
          description="A tokenized bond, issued on Stellar."
          meta={
            <>
              <span className={styles.glyphItem}>
                <Glyph name="bond" /> Bond
              </span>
              <Address value={SAMPLE_ADDRESS} name="Issuer" explorerUrl={EXPLORER} />
              <span>Demo price 9.82 USDx</span>
            </>
          }
          actions={
            <Segmented
              label="Mode"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'guided', label: 'Guided' },
                { value: 'chain', label: 'Chain' },
              ]}
            />
          }
        />
      </Specimen>

      <Specimen title="Tabs" note="Panels swap in place. Arrow keys move between tabs, Enter or Space activates, Tab goes into the panel." layout="stack">
        <Tabs value={tab} onValueChange={setTab}>
          <TabList label="Positions">
            <Tab value="holding" count={2} countLabel="2 positions held">
              Holding
            </Tab>
            <Tab value="written" count={1} countLabel="1 position written">
              Written
            </Tab>
            <Tab value="orders">Orders</Tab>
            <Tab value="closed" disabled>
              Closed
            </Tab>
          </TabList>
          <TabPanel value="holding">
            <p className={styles.prose}>Two options you hold, each with its deadline.</p>
          </TabPanel>
          <TabPanel value="written">
            <p className={styles.prose}>One option you wrote, with the collateral it locks.</p>
          </TabPanel>
          <TabPanel value="orders">
            <EmptyNote title="No open orders." hint="Offers, requests and resale listings you post appear here." />
          </TabPanel>
        </Tabs>
      </Specimen>

      <Specimen title="Navigation tabs" note="Links between sub-pages. The current page carries aria-current. Here they only change the specimen." layout="stack">
        <NavTabs label="Margin sections">
          {[
            ['account', 'Account'],
            ['trade', 'Trade'],
            ['positions', 'Positions'],
            ['liquidations', 'Liquidations'],
            ['vault', 'Vault'],
          ].map(([id, label]) => (
            <NavTab
              key={id}
              href={`#navigation`}
              current={page === id}
              count={id === 'positions' ? 3 : undefined}
              countLabel="3 positions"
              onClick={(event) => {
                event.preventDefault()
                setPage(id)
              }}
            >
              {label}
            </NavTab>
          ))}
        </NavTabs>
      </Specimen>

      <Specimen title="Skip link" note="The first focusable element of every page. Press Tab at the top of this page to see it.">
        <Example label="Moves focus to the main landmark">
          <Button variant="quiet" onClick={() => document.querySelector<HTMLElement>('a[href="#gallery-main"], a[href="#main"]')?.focus()}>
            Show the skip link
          </Button>
        </Example>
      </Specimen>
    </Section>
  )
}
