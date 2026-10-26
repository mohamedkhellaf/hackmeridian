import { expect, test } from '@playwright/test'

// Strata Pro (experimental) runs on fixtures here (the dev server is started with VITE_ENABLE_PRO=1).
test.describe('Strata Pro (simulated)', () => {
  test('every screen carries the mandatory banners and the simulated label', async ({ page }) => {
    await page.goto('/#/pro')
    const notices = page.getByRole('note', { name: 'Strata Pro notices' })
    for (const sub of ['margin', 'trade', 'positions', 'liquidations', 'vault']) {
      await page.goto(`/#/pro/${sub}`)
      await expect(notices).toContainText('Testnet only. Partial margin: payouts can be reduced; any deficit is shown.')
      await expect(notices).toContainText("Prices and the settlement price are set by the team's publisher.")
      await expect(notices).toContainText('Simulated, not on-chain')
      await expect(page.getByRole('region', { name: 'Oracle' })).toBeVisible()
    }
  })

  test('shows a writer below maintenance and maps the exercise refusals', async ({ page }) => {
    await page.goto('/#/pro/margin')
    await expect(page.getByRole('group', { name: 'NLV' })).toBeVisible()
    await expect(page.getByText('Below maintenance margin')).toBeVisible()

    await page.goto('/#/pro/positions')
    await page.getByRole('button', { name: 'Exercise early' }).click()
    await expect(page.getByRole('alert')).toContainText('LiquidateFirst')

    await page.goto('/#/pro/liquidations')
    await page.getByRole('button', { name: 'Take over to the vault' }).first().click()
    await expect(page.getByText('Taken over to the vault.')).toBeVisible()

    await page.goto('/#/pro/positions')
    await page.getByRole('button', { name: 'Exercise early' }).click()
    await expect(page.getByRole('alert')).toContainText('This position is owned by the vault and settles at expiry.')
  })

  test('the buy dialog needs the partial-collateral acknowledgement', async ({ page }) => {
    await page.goto('/#/pro/trade')
    await page.getByRole('combobox', { name: 'Scenario' }).selectOption('happy_path_otm')
    await page.getByRole('slider', { name: 'Simulation step' }).fill('5')
    await page.getByRole('button', { name: 'Buy', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('only partially collateralized')
    const confirm = dialog.getByRole('button', { name: 'Buy call' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox').check()
    await expect(confirm).toBeEnabled()
  })

  test('Covered navigation is untouched', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Pro (experimental)' })).toBeVisible()
    await expect(page.locator('footer.shell-footer')).toContainText('fully collateralized')
    await page.goto('/#/pro')
    await expect(page.locator('footer.shell-footer')).toHaveCount(0)
  })
})
