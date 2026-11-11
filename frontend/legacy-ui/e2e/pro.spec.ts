import { expect, test } from '@playwright/test'
import { connect, openApp, openTrade } from './helpers.ts'

// The margin section (code name `pro`) runs on fixtures here (the dev server is started with VITE_ENABLE_PRO=1).
const SIMULATED = 'Margin (experimental). Simulated on fixtures. No contract is called.'
const WARNING = 'Margin positions carry default risk'

test.describe('Margin (simulated)', () => {
  // Every test but the warning tests starts with the session acknowledgement already recorded.
  test.beforeEach(async ({ page }, info) => {
    if (info.title.includes('default-risk warning')) return
    await page.addInitScript(() => sessionStorage.setItem('stellsec.margin.ack', '1'))
  })

  test('every screen carries the one simulated banner, the sub-navigation and the oracle row', async ({ page }) => {
    for (const sub of ['margin', 'trade', 'positions', 'liquidations', 'vault']) {
      await page.goto(`/#/pro/${sub}`)
      await expect(page.getByRole('note').filter({ hasText: SIMULATED })).toHaveCount(1)
      await expect(page.getByRole('radiogroup', { name: 'Margin sections' }).getByRole('radio', { checked: true })).toHaveText(new RegExp(sub, 'i'))
      await expect(page.getByRole('region', { name: 'Oracle' })).toBeVisible()
    }
  })

  test('the segmented control switches margin screens', async ({ page }) => {
    await page.goto('/#/pro')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Margin')
    await page.getByRole('radiogroup', { name: 'Margin sections' }).getByRole('radio', { name: 'Vault' }).click()
    await expect(page).toHaveURL(/#\/pro\/vault$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vault')
  })

  test('shows a writer below maintenance and maps the exercise refusals', async ({ page }) => {
    await page.goto('/#/pro/margin')
    await expect(page.getByRole('group', { name: 'NLV (USDx)' })).toBeVisible()
    await expect(page.getByText('Below maintenance margin')).toBeVisible()

    await page.goto('/#/pro/positions')
    await page.getByRole('button', { name: 'Exercise early' }).click()
    await expect(page.getByRole('alert')).toContainText('LiquidateFirst (224)')

    await page.goto('/#/pro/liquidations')
    await page.getByRole('button', { name: 'Take over to the vault' }).first().click()
    await expect(page.getByText('Taken over by the vault')).toBeVisible()

    await page.goto('/#/pro/positions')
    await page.getByRole('button', { name: 'Exercise early' }).click()
    await expect(page.getByRole('alert')).toContainText('This position is owned by the vault and settles at expiry.')
  })

  test('the buy dialog needs the payout acknowledgement', async ({ page }) => {
    await page.goto('/#/pro/trade')
    await page.getByRole('combobox', { name: 'Scenario' }).selectOption('happy_path_otm')
    await page.getByRole('slider', { name: 'Simulation step' }).fill('5')
    await page.getByRole('button', { name: 'Buy', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Buy EQTY call' })
    await expect(dialog).toContainText('Writer margin')
    await expect(dialog).toContainText('Deficit, cuts your payout')
    const confirm = dialog.getByRole('button', { name: /^Buy for .* USDx$/ })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox', { name: 'I understand my payout can be reduced.' }).check()
    await expect(confirm).toBeEnabled()
  })

  test('series expiry shows the countdown as "2d 23h", with no "in"', async ({ page }) => {
    await page.goto('/#/pro/trade')
    const expiry = page.getByRole('table').first().getByRole('row').nth(1).getByRole('cell').nth(3)
    await expect(expiry).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2} \d+d \d+h$/)
  })

  test('at 390px no page or margin table scrolls sideways; the row button takes the State cell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const sub of ['margin', 'trade', 'positions', 'liquidations', 'vault']) {
      await page.goto(`/#/pro/${sub}`)
      await expect(page.getByRole('region', { name: 'Oracle' })).toBeVisible()
      const overflow = await page.evaluate(() => [
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ...[...document.querySelectorAll('.ui-table-wrap')].map((e) => e.scrollWidth - e.clientWidth),
      ])
      expect(Math.max(...overflow), sub).toBeLessThanOrEqual(0)
    }
    await page.goto('/#/pro/positions')
    await expect(page.getByRole('columnheader', { name: 'Holder' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Exercise early' })).toBeVisible()
  })

  test('Margin is a plain link at the end of the main navigation, inside the main shell', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' }).first()
    await expect(nav.getByRole('link').last()).toHaveText('Margin')
    await expect(page.getByRole('link', { name: /^Pro$/ })).toHaveCount(0)
    await page.goto('/#/pro')
    await expect(page.locator('footer.shell-footer')).toContainText('Stellar Testnet. Fictional assets and makers. No real funds.')
  })

  test('entering from the navigation shows the default-risk warning once; Continue needs the tick', async ({ page }) => {
    await page.goto('/#/pro')
    const dialog = page.getByRole('dialog', { name: WARNING })
    await expect(dialog).toContainText('Partial margin can be liquidated at the published price.')
    await expect(dialog).toContainText('Payouts to holders can be reduced, and any deficit is shown.')
    await expect(dialog).toContainText('a demo oracle, not a market')
    const go = dialog.getByRole('button', { name: 'Continue' })
    await expect(go).toBeDisabled()
    await dialog.getByRole('checkbox', { name: 'I understand' }).check()
    await expect(go).toBeEnabled()
    await go.click()
    await expect(dialog).toHaveCount(0)
    await page.goto('/#/pro/vault')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vault')
    await expect(page.getByRole('dialog', { name: WARNING })).toHaveCount(0)
  })

  test('cancelling the default-risk warning on entry leaves the margin section', async ({ page }) => {
    await page.goto('/#/pro/trade')
    await page.getByRole('dialog', { name: WARNING }).getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/#\/markets$/)
  })

  test('Sell offers a collateral choice; Margin needs the default-risk warning ticked, then opens the margin Trade screen', async ({ page }) => {
    await openApp(page)
    await connect(page)
    await openTrade(page, /^Put at 10\.00/, 'Sell', 'Post an offer at my price')
    const sell = page.getByRole('dialog', { name: 'Sell FUND 10.00 put' })
    const choice = sell.getByRole('radiogroup', { name: 'Collateral' })
    await expect(choice.getByRole('radio', { name: /^Full collateral/ })).toBeChecked()
    await expect(choice).toContainText('Your only risk is issuer action.')
    await expect(choice).toContainText('if the vault runs dry the holder is paid less')

    // Cancel goes back to full collateral.
    await choice.getByRole('radio', { name: /^Margin/ }).click()
    let warning = page.getByRole('dialog', { name: WARNING })
    await warning.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog', { name: 'Sell FUND 10.00 put' }).getByRole('radio', { name: /^Full collateral/ })).toBeChecked()

    await page.getByRole('dialog', { name: 'Sell FUND 10.00 put' }).getByRole('radio', { name: /^Margin/ }).click()
    warning = page.getByRole('dialog', { name: WARNING })
    const go = warning.getByRole('button', { name: 'Continue' })
    await expect(go).toBeDisabled()
    await warning.getByRole('checkbox', { name: 'I understand' }).check()
    await expect(go).toBeEnabled()
    await go.click()
    await expect(page).toHaveURL(/#\/pro\/trade$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trade')
    // Acknowledged for the session: no second warning on entry.
    await expect(page.getByRole('dialog', { name: WARNING })).toHaveCount(0)
  })
})
