import { expect, test } from '@playwright/test'
import { openApp } from './helpers.ts'

test('mock banner and issuer disclaimer are visible', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Mock data: no contract connected')).toBeVisible()
  await expect(page.getByText(/Issuer controls \(freeze, clawback\) on regulated assets can block settlement/)).toBeVisible()
  await expect(page.getByText(/not a guarantee against issuer action/)).toBeVisible()
})
