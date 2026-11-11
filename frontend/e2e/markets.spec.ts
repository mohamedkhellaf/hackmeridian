/**
 * Markets: the index (intents, assets, reference prices) and the asset page frame (header, tabs, mode switch,
 * Requests and About tabs, the idle ticket rail). The guided flow, the chain and the ticket have their own specs.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ISSUER_DISCLOSURE } from '../src/core/disclosures'
import { ADDR_A, connect, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading, switchAccount } from './helpers'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'

const assetsTable = (page: Page) => page.getByRole('table', { name: 'Assets' })
const requestsTable = (page: Page) => page.getByRole('table', { name: /^Open requests on/ })
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Asset sections' })
const modeSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Mode' })

test.describe('markets index', () => {
  test('lists the reference assets with their reference price and its label', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(pageHeading(page)).toHaveText('Markets')
    const table = assetsTable(page)
    await expect(table.getByRole('row')).toHaveCount(4) // the header and FUND, BOND, EQTY

    const bond = table.getByRole('row', { name: /BOND/ })
    // The type is the label alone: no hedge word in a caption (what the token is, is said on its About tab).
    await expect(bond.getByRole('rowheader')).toContainText('Bond')
    await expect(bond.getByRole('rowheader')).not.toContainText(/fictional/i)
    await expect(bond.getByRole('rowheader')).toContainText('Issuer')
    await expect(bond).toContainText('Reference')
    // The reference figure never stands alone: it carries its label, and nothing calls it a market price.
    await expect(bond).toContainText('99.40')
    await expect(bond).toContainText('Demo price')
    await expect(table.getByRole('row', { name: /FUND/ })).toContainText('10.20')
    await expect(table.getByRole('row', { name: /EQTY/ })).toContainText('24.60')
    await expect(page.getByRole('main')).not.toContainText(/market price|oracle price|live price/i)

    // Open offers, the nearest expiry and the lowest premiums are read from the mock market.
    await expect(bond.getByRole('cell').nth(2)).toHaveText(/^\d+$/)
    await expect(bond.getByRole('link', { name: 'Trade BOND' })).toHaveAttribute('href', /\/markets\/bond$/)

    await expect(page.getByText('Showing 3 reference assets. No other asset is listed in the contract.')).toBeVisible()
    // The tier word is explained under the table that uses it.
    await expect(page.getByText("Issued by this project's test issuer and kept in the app's asset list.")).toBeVisible()
  })

  test('an intent card asks for the asset, then opens it in guided mode with the intent in the URL', async ({ page }) => {
    await openApp(page, '/markets')
    const cards = page.getByRole('region', { name: 'What do you want to do?' })
    await expect(cards.getByRole('link', { name: /^Set a floor/ })).toContainText('You pay')
    await expect(cards.getByRole('link', { name: /^Earn on what you hold/ })).toContainText('You are paid')
    await expect(cards.getByRole('link', { name: /^Earn while waiting to buy/ })).toContainText('You are paid')

    await cards.getByRole('link', { name: /^Set a floor/ }).click()
    await expect(page).toHaveURL(/\/markets\?intent=floor$/)
    const choice = page.getByRole('region', { name: 'Set a floor on which asset?' })
    await expect(choice.getByRole('heading')).toBeFocused()
    // The card whose choice is open is the link to the current address, and only that one.
    await expect(cards.getByRole('link', { name: /^Set a floor/ })).toHaveAttribute('aria-current', 'page')
    await expect(cards.locator('[aria-current]')).toHaveCount(1)
    await expect(choice.getByRole('link')).toHaveCount(4) // three assets and "Choose something else"

    await choice.getByRole('link', { name: /Set a floor on BOND/ }).click()
    await expect(page).toHaveURL(/\/markets\/bond\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('mode')).toBe('guided')
    expect(url.searchParams.get('intent')).toBe('floor')
    await expect(pageHeading(page)).toHaveText('BOND')
    await expect(modeSwitch(page).getByRole('radio', { name: 'Guided' })).toBeChecked()
  })

  test('the choice survives a reload, shows what a connected wallet holds, and can be dropped', async ({ page }) => {
    await openApp(page, '/markets?intent=earn-hold', { connect: true })
    const choice = page.getByRole('region', { name: 'Earn on which asset?' })
    await expect(choice.getByRole('link', { name: /FUND/ })).toContainText('You hold 120.00 FUND')
    await expect(choice.getByRole('link', { name: /BOND/ })).toContainText('You hold 12.00 BOND')
    await choice.getByRole('link', { name: 'Choose something else' }).click()
    await expect(page).toHaveURL(/\/markets$/)
    await expect(choice).toBeHidden()
  })

  test('the secondary intent is one line under the cards', async ({ page }) => {
    await openApp(page, '/markets')
    await page.getByRole('link', { name: 'Lock a buy price' }).click()
    await expect(page).toHaveURL(/intent=lock-buy/)
    await page.getByRole('region', { name: 'Lock a buy price on which asset?' }).getByRole('link', { name: /EQTY/ }).click()
    expect(await currentPath(page)).toBe('/markets/eqty?mode=guided&intent=lock-buy')
  })

  test('a funded wallet gets no "Get test funds" strip', async ({ page }) => {
    await openApp(page, '/markets', { connect: true })
    await expect(assetsTable(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Get test funds' })).toHaveCount(0)
  })
})

test.describe('asset page', () => {
  test('the header names the asset, its issuer, its tier and the source of its reference price', async ({ page }) => {
    await openApp(page, '/markets/bond')
    await expect(page).toHaveTitle('BOND · Markets · StellSec')
    const header = page.getByRole('main').locator('header').first()
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('BOND')
    await expect(header).toContainText('Bond')
    await expect(header).not.toContainText(/fictional/i)
    await expect(header).toContainText('Reference price')
    await expect(header).toContainText('99.40')
    await expect(header).toContainText('Demo price. Chosen by the team for this demo. Not a market.')
    await expect(header).toContainText('Issuer')
    await expect(header).toContainText('Reference')
    // A guest sees where the balances will be, not an empty cell.
    await expect(header).toContainText('Connect a wallet to see what you hold.')

    await connect(page)
    await expect(header).toContainText('12.00')
    await expect(header).toContainText('2,500.00')
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

  test('the ticket rail is a blank note until something is picked', async ({ page }) => {
    await openApp(page, '/markets/bond?tab=requests')
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'No order yet.' })).toBeVisible()
    await expect(rail).toContainText('Choose a request to sell to, or post your own.')
  })
})

test.describe('requests tab', () => {
  test('lists the funded bids of the asset with what a seller needs to decide', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    await expect(page.getByRole('heading', { name: 'Requests', level: 2 })).toBeVisible()
    await expect(page.getByRole('main')).toContainText("A request is a buyer's premium already escrowed in the contract, waiting for a seller.")
    await expect(tabs(page).getByRole('link', { name: /^Requests/ })).toContainText('2')

    const table = requestsTable(page)
    await expect(table.getByRole('columnheader')).toHaveText(['Kind', 'Strike', 'Quantity', 'Expiry', 'Premium escrowed', 'Buyer', 'State', 'Action'])
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    for (const row of await rows.all()) {
      await expect(row).toContainText('Put')
      await expect(row).toContainText('FUND')
      await expect(row).toContainText('USDx')
      await expect(row).toContainText('Open')
      await expect(row.getByRole('link', { name: /^Sell to this bid/ })).toBeVisible()
    }
    // Every column is on screen at 1440 px: the table does not scroll inside its frame.
    await expect(page.locator('.ui-table-wrap[data-scrolls]')).toHaveCount(0)
    // Highest premium per unit first: the per-unit figure sits under the escrowed total.
    const premiums = await rows.locator('td:nth-child(5)').allInnerTexts()
    const figures = premiums.map((t) => Number(/([\d.]+) per unit/.exec(t)?.[1]))
    expect(figures.every((f) => Number.isFinite(f))).toBe(true)
    expect(figures[0]).toBeGreaterThanOrEqual(figures[1])
  })

  test('"Sell to this bid" and "Post a request" open the ticket through the URL', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    const first = requestsTable(page).locator('tbody tr').first()
    await first.getByRole('link', { name: /^Sell to this bid/ }).click()
    await expect(page).toHaveURL(/[?&]bid=\d+/)
    await expect(page).toHaveURL(/tab=requests/)

    await page.goBack()
    await expect(page).not.toHaveURL(/[?&]bid=/)
    await page.getByRole('main').getByRole('link', { name: 'Post a request' }).click()
    await expect(page).toHaveURL(/side=bid/)
  })

  test('your own request is marked and can be cancelled, which refunds the premium', async ({ page }) => {
    await openApp(page, '/markets/bond?tab=requests', { connect: true })
    const row = requestsTable(page).locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Yours')
    await expect(row.locator('mark')).toContainText('USDx') // the escrowed premium is the wallet's own figure
    await row.getByRole('button', { name: /^Cancel your request/ }).click()
    await expect(page.getByRole('heading', { name: 'No open requests on BOND.' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Post a request' })).toBeVisible()
  })
})

test.describe('about tab', () => {
  test('says what the asset is, what its issuer can do and which contract holds the collateral', async ({ page }) => {
    await openApp(page, '/markets/bond?tab=about')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Asset facts' })).toBeVisible()
    await expect(main).toContainText('Mock asset. No on-chain facts.')

    const powers = page.getByRole('table', { name: 'Issuer powers' })
    // A mock asset answers with fixture flags (marked as such), so each power reads On or Off and the table has
    // its fourth row: whether the issuer can still change them.
    await expect(powers.getByRole('rowheader')).toHaveText(['Authorization required', 'Authorization revocable', 'Clawback enabled', 'Change these settings'])
    await expect(powers).not.toContainText('Not read')
    await expect(powers.getByRole('row', { name: /^Clawback enabled/ })).toContainText('On')
    await expect(main).toContainText('Mock asset: these flags are settings of the demo, not read from a chain.')
    await expect(powers).toContainText('The issuer can take tokens back, including from the options contract.')
    // The required sentence has its home here, verbatim and once.
    await expect(main.getByText(ISSUER_DISCLOSURE)).toHaveCount(1)

    await expect(main.getByRole('heading', { name: 'What it means for an option' })).toBeVisible()
    await expect(main).toContainText('A frozen holder cannot exercise.')
    await expect(main.getByRole('heading', { name: 'Contract and roles' })).toBeVisible()
    await expect(main).toContainText('None. No admin function exists.')
    await expect(main).toContainText('None. No outside party has reviewed the code.')
    await expect(main.getByRole('link', { name: 'Reserves, contracts and roles' })).toHaveAttribute('href', /\/reserves$/)

    await expect(main).toContainText('Connect a wallet to see whether you can hold BOND.')
    await connect(page)
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

  test('on a phone the assets are cards and every action is a 44 px target @phone', async ({ page }) => {
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
  })

  test('on a phone the requests are a list, and the mode switch sits under the tabs @phone', async ({ page }) => {
    await openApp(page, '/markets/fund?tab=requests')
    await expect(requestsTable(page)).toBeHidden()
    const items = page.getByRole('list', { name: 'Open requests on FUND' }).getByRole('listitem')
    await expect(items).toHaveCount(2)
    const sell = await items.first().getByRole('link', { name: /^Sell to this bid/ }).boundingBox()
    expect(sell?.height ?? 0).toBeGreaterThanOrEqual(44)

    await tabs(page).getByRole('link', { name: 'Trade' }).click()
    const nav = await tabs(page).boundingBox()
    const mode = await modeSwitch(page).boundingBox()
    expect(mode && nav && mode.y >= nav.y + nav.height - 1).toBe(true)
    // The control is 44 px tall on a touch screen (its two segments sit inside a 1 px border).
    expect(mode?.height ?? 0).toBeGreaterThanOrEqual(44)
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

  test('the asset page shows the empty balances as they are', async ({ page }) => {
    await openApp(page, '/markets/bond', { connect: DEMO_WALLETS.c })
    const header = page.getByRole('main').locator('header').first()
    await expect(header).toContainText('0.00')
  })
})

