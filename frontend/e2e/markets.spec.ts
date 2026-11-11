/**
 * Markets: the index (intents, assets, reference prices) and the asset page frame (header, tabs, mode switch,
 * Requests and About tabs, the rail and the ticket's history). The guided flow, the chain and the ticket have their
 * own specs.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ISSUER_DISCLOSURE } from '../src/core/disclosures'
import { REFERENCE_LABEL, REFERENCE_NOTE } from '../src/core/reference'
import { ADDR_A, connect, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading, routeTo, switchAccount } from './helpers'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'

const assetsTable = (page: Page) => page.getByRole('table', { name: 'Assets' })
const requestsTable = (page: Page) => page.getByRole('table', { name: /^Open requests on/ })
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Asset sections' })
const modeSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Mode' })

test.describe('markets index', () => {
  test('lists the reference assets with their reference price and its source', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(pageHeading(page)).toHaveText('Markets')
    const table = assetsTable(page)
    await expect(table.getByRole('row')).toHaveCount(4) // the header and FUND, BOND, EQTY

    const bond = table.getByRole('row', { name: /BOND/ })
    // The type is the label alone: no hedge word in a caption (what the token is, is said on its About tab).
    await expect(bond.getByRole('rowheader')).toHaveText(/^BOND\s*Bond$/)
    // A fact that is the same on every row is not a cell: no tier column, no issuer line for a reference asset,
    // and the price source named once, in the header, because every row shares it.
    await expect(table.getByRole('columnheader', { name: 'Tier' })).toHaveCount(0)
    await expect(table.getByRole('columnheader', { name: /^Demo price/ })).toContainText('USDx')
    await expect(bond).toContainText('99.40')
    await expect(table.getByRole('row', { name: /FUND/ })).toContainText('10.20')
    await expect(table.getByRole('row', { name: /EQTY/ })).toContainText('24.60')
    await expect(page.getByRole('main')).not.toContainText(/market price|oracle price|live price/i)

    // Open offers, the nearest deadline and the cheapest premiums are read from the mock market; a cheapest
    // premium names the strike and the day it is for.
    await expect(bond.getByRole('cell').nth(1)).toHaveText(/^\d+$/)
    await expect(bond.getByRole('cell').nth(3)).toContainText(/at [\d,.]+, \d+ [A-Z][a-z]{2}/)
    await expect(bond.getByRole('link', { name: 'Trade BOND' })).toHaveAttribute('href', /\/markets\/bond$/)

    // Nothing is hidden, so there is no count line, no tier legend and no note about the list.
    await expect(page.getByText(/reference assets?\./)).toHaveCount(0)
    await expect(page.getByText("Issued by this project's test issuer and kept in the app's asset list.")).toHaveCount(0)
  })

  test('the whole row is the target of its one action', async ({ page }) => {
    await openApp(page, '/markets')
    const bond = assetsTable(page).getByRole('row', { name: /BOND/ })
    // One tab stop per row: the action. A click anywhere on the row follows it.
    await expect(bond.getByRole('link')).toHaveCount(1)
    // A click on a figure, far from the action, opens the asset: the action covers the row.
    const cell = await bond.getByRole('cell').nth(1).boundingBox()
    if (!cell) throw new Error('The row has no box')
    await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2)
    await expect(page).toHaveURL(/\/markets\/bond$/)
  })

  test('an intent asks for the asset in the Assets section, then opens it in guided mode with the intent', async ({ page }) => {
    await openApp(page, '/markets')
    const intents = page.getByRole('region', { name: 'What do you want to do?' })
    // Four equal rows, each with who pays and when.
    await expect(intents.getByRole('listitem')).toHaveCount(4)
    await expect(intents.getByRole('link', { name: /^Set a floor/ })).toContainText('You pay for that right once, when you buy: the premium.')
    await expect(intents.getByRole('link', { name: /^Earn on what you hold/ })).toContainText('A buyer pays you for that agreement, the premium, when one takes your terms.')
    await expect(intents.getByRole('link', { name: /^Earn while waiting to buy/ })).toContainText('A buyer pays you')
    await expect(intents.getByRole('link', { name: /^Lock a buy price/ })).toContainText('You pay for that right once')

    await intents.getByRole('link', { name: /^Set a floor/ }).click()
    await expect(page).toHaveURL(/\/markets\?intent=floor$/)
    // The Assets section asks the question and takes focus; there is no second list of the same assets.
    const question = page.getByRole('heading', { name: 'Set a floor on which asset?' })
    await expect(question).toBeFocused()
    await expect(page.getByRole('region', { name: 'Set a floor on which asset?' }).getByRole('table')).toHaveCount(1)
    // The row whose question is open is the link to the current address, and only that one.
    await expect(intents.getByRole('link', { name: /^Set a floor/ })).toHaveAttribute('aria-current', 'page')
    await expect(intents.locator('[aria-current]')).toHaveCount(1)

    await assetsTable(page).getByRole('link', { name: 'Set a floor on BOND' }).click()
    await expect(page).toHaveURL(/\/markets\/bond\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('mode')).toBe('guided')
    expect(url.searchParams.get('intent')).toBe('floor')
    await expect(pageHeading(page)).toHaveText('BOND')
    await expect(modeSwitch(page).getByRole('radio', { name: 'Guided' })).toBeChecked()
  })

  test('the question survives a reload, shows what a connected wallet holds, and can be dropped', async ({ page }) => {
    await openApp(page, '/markets?intent=earn-hold', { connect: true })
    const table = assetsTable(page)
    await expect(table.getByRole('columnheader', { name: 'You hold' })).toBeVisible()
    await expect(table.getByRole('row', { name: /FUND/ })).toContainText('120.00')
    await expect(table.getByRole('row', { name: /BOND/ })).toContainText('12.00')
    await page.getByRole('main').getByRole('link', { name: 'Choose something else' }).click()
    await expect(page).toHaveURL(/\/markets$/)
    await expect(page.getByRole('heading', { name: 'Assets', level: 2 })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'You hold' })).toHaveCount(0)
  })

  test('the fourth intent is a row like the others', async ({ page }) => {
    await openApp(page, '/markets')
    await page.getByRole('region', { name: 'What do you want to do?' }).getByRole('link', { name: /^Lock a buy price/ }).click()
    await expect(page).toHaveURL(/intent=lock-buy/)
    await assetsTable(page).getByRole('link', { name: 'Lock a buy price on EQTY' }).click()
    expect(await currentPath(page)).toBe('/markets/eqty?mode=guided&intent=lock-buy')
  })

  test('a funded wallet gets no "Get test funds" strip unless it asks for one', async ({ page }) => {
    await openApp(page, '/markets', { connect: true })
    await expect(assetsTable(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Get test funds' })).toHaveCount(0)
    await routeTo(page, '/markets?funds=1')
    await expect(page.getByRole('region', { name: 'Get test funds' })).toContainText('Three steps, all in your wallet.')
  })
})

test.describe('asset page', () => {
  test('the header names the asset, its issuer and the source of its reference price', async ({ page }) => {
    await openApp(page, '/markets/bond')
    await expect(page).toHaveTitle('BOND · Markets · StellSec')
    const header = page.getByRole('main').locator('header').first()
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('BOND')
    await expect(header).toContainText('Bond')
    await expect(header).not.toContainText(/fictional/i)
    await expect(header).toContainText('99.40')
    // The asset header is the one home of the sentence that explains the price's label.
    await expect(header).toContainText(`${REFERENCE_LABEL.demo}. ${REFERENCE_NOTE.demo}`)
    await expect(header).toContainText('Issuer')
    // Every asset of the app's list is "Reference": the tier word is only shown when it is not.
    await expect(header).not.toContainText('Tier')
    // A guest sees only what is known: no holdings slot and no invitation to connect beside the one in the bar.
    await expect(header).not.toContainText('You hold')
    // The back link is not the current page.
    await expect(header.getByRole('link', { name: 'Markets' })).not.toHaveAttribute('aria-current', 'page')

    await connect(page)
    await expect(header).toContainText('You hold')
    await expect(header).toContainText('12.00')
    await expect(header).toContainText('2,500.00')
    await expect(header.getByRole('link', { name: 'Get test funds' })).toHaveCount(0)
  })

  test('the mode switch is remembered across a reload and across assets', async ({ page }) => {
    await openApp(page, '/markets/bond')
    const guided = modeSwitch(page).getByRole('radio', { name: 'Guided' })
    const chain = modeSwitch(page).getByRole('radio', { name: 'Chain' })
    await expect(guided).toBeChecked() // the default

    await chain.click()
    await expect(chain).toBeChecked()
    await expect(page).toHaveURL(/mode=chain/)

    await page.reload()
    await expect(modeSwitch(page).getByRole('radio', { name: 'Chain' })).toBeChecked()

    // Without the param the remembered choice applies: it is a setting, not only a URL.
    await page.goto('/markets/fund')
    await expect(pageHeading(page)).toHaveText('FUND')
    await expect(modeSwitch(page).getByRole('radio', { name: 'Chain' })).toBeChecked()

    // A link that names a mode wins over the setting, without changing it.
    await page.goto('/markets/fund?mode=guided')
    await expect(modeSwitch(page).getByRole('radio', { name: 'Guided' })).toBeChecked()
  })

  test('the mode switch works from the keyboard as one radio group', async ({ page }) => {
    await openApp(page, '/markets/bond')
    await modeSwitch(page).getByRole('radio', { name: 'Guided' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(modeSwitch(page).getByRole('radio', { name: 'Chain' })).toBeChecked()
    await expect(page).toHaveURL(/mode=chain/)
  })

  test('the sub-tabs are links, mark the current page and survive a reload', async ({ page }) => {
    await openApp(page, '/markets/bond')
    const nav = tabs(page)
    await expect(nav.getByRole('link', { name: 'Trade' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: /^Requests/ })).toHaveAttribute('href', /\/markets\/bond\?tab=requests$/)
    await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', /\/markets\/bond\?tab=about$/)

    await nav.getByRole('link', { name: 'About' }).click()
    await expect(page).toHaveURL(/tab=about/)
    await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.locator('[aria-current]')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Asset facts' })).toBeVisible()
    // The mode switch belongs to the Trade tab.
    await expect(modeSwitch(page)).toHaveCount(0)

    await page.reload()
    await expect(tabs(page).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Asset facts' })).toBeVisible()

    await page.goBack()
    await expect(tabs(page).getByRole('link', { name: 'Trade' })).toHaveAttribute('aria-current', 'page')
  })

  test('an alias of a reference asset is replaced by its canonical address', async ({ page }) => {
    await openApp(page, '/markets/C_MOCK_BOND?tab=about')
    await expect(page).toHaveURL(/\/markets\/bond\?tab=about$/)
    await expect(pageHeading(page)).toHaveText('BOND')
  })

  test('an unknown asset gets a not-found view that leads somewhere', async ({ page }) => {
    await openApp(page, '/markets/nosuchasset')
    await expect(pageHeading(page)).toHaveText('Asset not found')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'The contract does not list this asset.' })).toBeVisible()
    // The segment of the URL is never printed back.
    await expect(main).not.toContainText('nosuchasset')
    await expect(main.getByRole('link', { name: 'All markets' })).toHaveAttribute('href', /\/markets$/)
    const listed = main.getByRole('navigation', { name: 'Assets you can open' })
    await expect(listed.getByRole('link')).toHaveText(['FUND', 'BOND', 'EQTY'])
    await listed.getByRole('link', { name: 'EQTY' }).click()
    await expect(pageHeading(page)).toHaveText('EQTY')
  })

  test('a malformed address says so', async ({ page }) => {
    await openApp(page, '/markets/%3Cscript%3E')
    await expect(pageHeading(page)).toHaveText('Asset not found')
    await expect(page.getByRole('heading', { name: 'This link does not name an asset.' })).toBeVisible()
  })

  test('the rail holds no idle text: chain mode leaves it empty, the Requests tab spans the width until a ticket opens', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    // The column is kept so the chain does not jump when a ticket opens, but it is not a landmark while empty.
    await expect(page.getByRole('main')).not.toContainText('No order yet')
    await expect(page.getByRole('complementary', { name: 'Order ticket' })).toHaveCount(0)
    await page.getByRole('radio', { name: 'Guided' }).click()
    await expect(page.getByRole('complementary', { name: 'Order ticket' })).toContainText('You pay')

    await tabs(page).getByRole('link', { name: /^Requests/ }).click()
    await expect(page.getByRole('complementary', { name: 'Order ticket' })).toHaveCount(0)
    await page.getByRole('main').getByRole('link', { name: 'Post a request' }).click()
    await expect(page.getByRole('complementary', { name: 'Order ticket' })).toBeVisible()
  })

  test('closing the ticket never leaves an entry that reopens it', async ({ page }) => {
    await openApp(page, '/markets')
    await assetsTable(page).getByRole('link', { name: 'Trade FUND' }).click()
    await expect(pageHeading(page)).toHaveText('FUND')
    await tabs(page).getByRole('link', { name: /^Requests/ }).click()
    await requestsTable(page).locator('tbody tr').first().getByRole('link', { name: /^Fill request/ }).click()
    await expect(page).toHaveURL(/[?&]bid=\d+/)
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await rail.getByRole('button', { name: /^Close/ }).click()
    await expect(page).not.toHaveURL(/[?&]bid=/)
    // Back goes to where the user was before the ticket, never to the ticket again.
    await page.goBack()
    await expect(page).not.toHaveURL(/[?&]bid=/)
    await expect(page.getByRole('complementary', { name: 'Order ticket' })).toHaveCount(0)
  })
})

test.describe('requests tab', () => {
  test('lists the funded requests of the asset with what a maker needs to decide', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    // The tab says "Requests": the heading is for screen readers, the definition leads.
    await expect(page.getByRole('heading', { name: 'Requests', level: 2 })).toBeAttached()
    await expect(page.getByRole('main')).toContainText("A request is a buyer's premium already escrowed in the contract, waiting for a maker.")
    await expect(tabs(page).getByRole('link', { name: /^Requests/ })).toContainText('2')

    const table = requestsTable(page)
    await expect(table.getByRole('columnheader')).toHaveText(['Kind', 'Strike', 'Quantity', 'Deadline', 'Premium escrowed', 'Buyer', 'Action'])
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    for (const row of await rows.all()) {
      await expect(row).toContainText('Put')
      await expect(row).toContainText('FUND')
      await expect(row).toContainText('USDx')
      await expect(row.getByRole('link', { name: /^Fill request/ })).toBeVisible()
    }
    // Every column is on screen at 1440 px: the table does not scroll inside its frame.
    await expect(page.locator('.ui-table-wrap[data-scrolls]')).toHaveCount(0)
    // Highest premium per unit first: the per-unit figure sits under the escrowed total.
    const premiums = await rows.locator('td:nth-child(5)').allInnerTexts()
    const figures = premiums.map((t) => Number(/([\d.]+) per unit/.exec(t)?.[1]))
    expect(figures.every((f) => Number.isFinite(f))).toBe(true)
    expect(figures[0]).toBeGreaterThanOrEqual(figures[1])
  })

  test('"Fill request" and "Post a request" open the ticket through the URL', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    const first = requestsTable(page).locator('tbody tr').first()
    await first.getByRole('link', { name: /^Fill request/ }).click()
    await expect(page).toHaveURL(/[?&]bid=\d+/)
    await expect(page).toHaveURL(/tab=requests/)

    await page.goBack()
    await expect(page).not.toHaveURL(/[?&]bid=/)
    await page.getByRole('main').getByRole('link', { name: 'Post a request' }).click()
    await expect(page).toHaveURL(/side=bid/)
  })

  test('your own request is marked and is cancelled in a dialog that says what comes back', async ({ page }) => {
    await openApp(page, '/markets/bond?tab=requests', { connect: true })
    const row = requestsTable(page).locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Yours')
    await expect(row.locator('mark')).toContainText('USDx') // the escrowed premium is the wallet's own figure
    await row.getByRole('button', { name: /^Cancel your request/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel request' }).click()
    await expect(dialog.getByRole('button', { name: /^(Done|Close)$/ }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'No open requests on BOND.' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Post a request' })).toBeVisible()
  })
})

test.describe('about tab', () => {
  test('says what the token is, what its issuer can do and where the contract is described', async ({ page }) => {
    await openApp(page, '/markets/bond?tab=about')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Asset facts' })).toBeVisible()
    // What a token of the app's list is: said once, here, in a sentence.
    await expect(main.getByText("A test token issued by this project's issuer account on Stellar Testnet.")).toHaveCount(1)
    // The top bar says "Mock data"; no panel repeats it.
    await expect(main).not.toContainText(/Mock (asset|contract|ids)/)

    const powers = page.getByRole('table', { name: 'Issuer powers' })
    // A mock asset answers with the flags of the regulated asset it plays, so each power reads On or Off and the
    // table has its fourth row: whether the issuer can still change them.
    await expect(powers.getByRole('rowheader')).toHaveText(['Authorization required', 'Authorization revocable', 'Clawback enabled', 'Change these settings'])
    await expect(powers).not.toContainText('Not read')
    await expect(powers.getByRole('row', { name: /^Clawback enabled/ })).toContainText('On')
    await expect(powers).toContainText('The issuer can take tokens back, including from the Covered contract.')
    // The required sentence has its home here, verbatim and once.
    await expect(main.getByText(ISSUER_DISCLOSURE)).toHaveCount(1)

    await expect(main.getByRole('heading', { name: 'What it means for an option' })).toBeVisible()
    await expect(main).toContainText('A frozen holder cannot exercise.')
    // The contract's own facts are on Reserves, not repeated on every asset.
    await expect(main.getByRole('heading', { name: 'Contract and roles' })).toHaveCount(0)
    await expect(main.getByRole('heading', { name: 'On the explorer' })).toHaveCount(0)
    await expect(main.getByRole('link', { name: 'Reserves, contracts and roles' })).toHaveAttribute('href', /\/reserves$/)

    // A guest gets no access card; a connected wallet is told whether it can hold the asset.
    await expect(main.getByRole('heading', { name: 'Your access' })).toHaveCount(0)
    await connect(page)
    await expect(main.getByRole('heading', { name: 'Your access' })).toBeVisible()
    await expect(main).toContainText('Authorized by the BOND issuer.')
  })
})

test.describe('accessibility and layout', () => {
  const routes = ['/markets', '/markets?intent=floor', '/markets/bond', '/markets/fund?tab=requests', '/markets/bond?tab=about', '/markets/nosuchasset']

  for (const path of routes) {
    test(`axe is clean in both themes on ${path}`, async ({ page }) => {
      await openApp(page, path, { connect: path !== '/markets/nosuchasset' })
      await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0)
      await expectNoAxeViolations(page)
    })

    test(`nothing overflows at 390 px on ${path} @phone`, async ({ page }) => {
      await openApp(page, path)
      await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0)
      await expectNoHorizontalOverflow(page)
    })
  }

  test('on a phone the assets are cards, every action is a 44 px target, and the first asset is on the first screen @phone', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(assetsTable(page)).toBeHidden()
    const cards = page.getByRole('list', { name: 'Assets' }).getByRole('listitem')
    await expect(cards).toHaveCount(3)
    await expect(cards.nth(1)).toContainText('BOND')
    await expect(cards.nth(1)).toContainText('99.40')
    await expect(cards.nth(1)).toContainText('Demo price')
    for (const link of await page.getByRole('main').getByRole('link', { name: /^Trade / }).all()) {
      const box = await link.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    const intent = await page.getByRole('link', { name: /^Set a floor/ }).boundingBox()
    expect(intent?.height ?? 0).toBeGreaterThanOrEqual(44)
    // A returning visitor sees the first asset's code and price above the tab bar.
    const first = await cards.first().locator('[class*="cardHead"]').boundingBox()
    const bar = await page.locator('[data-tour="nav"]').filter({ visible: true }).first().boundingBox()
    expect(first && bar && first.y + first.height <= bar.y).toBe(true)
  })

  test('on a phone the requests are a list, and the mode switch sits on the tab row @phone', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    await expect(requestsTable(page)).toBeHidden()
    const items = page.getByRole('list', { name: 'Open requests on FUND' }).getByRole('listitem')
    await expect(items).toHaveCount(2)
    const sell = await items.first().getByRole('link', { name: /^Fill request/ }).boundingBox()
    expect(sell?.height ?? 0).toBeGreaterThanOrEqual(44)

    await tabs(page).getByRole('link', { name: 'Trade' }).click()
    const nav = await tabs(page).boundingBox()
    const mode = await modeSwitch(page).boundingBox()
    // One row: the switch at the right end of the tabs, so the flow starts high on the screen.
    expect(mode && nav && mode.y < nav.y + nav.height && mode.x > nav.x + 150).toBe(true)
    // The control is 44 px tall on a touch screen (its two segments sit inside a 1 px border).
    expect(mode?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect((nav?.y ?? 999) + (nav?.height ?? 0)).toBeLessThanOrEqual(300)
  })
})

test.describe('first run: a wallet that holds none of the tokens', () => {
  // The third test identity has no balance of any token (core/options/demoAccounts `DEMO_WALLETS.c`).
  test('shows the three steps to get test funds, and takes them away for a wallet that has balances @both', async ({ page }) => {
    await openApp(page, '/markets', { connect: DEMO_WALLETS.c })
    const strip = page.getByRole('region', { name: 'Get test funds' })
    await expect(strip).toBeVisible()
    await expect(strip).toContainText('This wallet holds none of the tokens traded here.')
    await expect(strip.getByRole('listitem')).toHaveCount(3)
    // A mock build says the steps will not change what it shows.
    await expect(strip).toContainText('This build runs on mock data')
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)

    // The same page as a wallet with balances has no such strip, and a guest never sees it.
    await switchAccount(page, ADDR_A)
    await expect(page.getByRole('heading', { name: 'Get test funds' })).toHaveCount(0)
  })

  test('the asset page shows the empty balances as they are, with the way to test tokens', async ({ page }) => {
    await openApp(page, '/markets/bond', { connect: DEMO_WALLETS.c })
    const header = page.getByRole('main').locator('header').first()
    await expect(header).toContainText('0.00')
    await header.getByRole('link', { name: 'Get test funds' }).click()
    await expect(page.getByRole('region', { name: 'Get test funds' })).toBeVisible()
  })
})

