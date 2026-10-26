import { expect, test } from '@playwright/test'
import { goTo, openApp } from './helpers.ts'

test('demo and mock banners and issuer disclaimer are visible', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Demo environment on Stellar Testnet. Assets and makers are fictional; no real funds are involved.')).toBeVisible()
  await expect(page.getByText('Mock data: no contract connected')).toBeVisible()
  await expect(page.getByText('Mock mode — no contract')).toBeVisible()
  await expect(page.getByText(/Issuer controls \(freeze, clawback\) on regulated assets can block settlement/)).toBeVisible()
  await expect(page.getByText(/not a guarantee against issuer action/)).toBeVisible()
})

test('reserves page is honest about mock data and shows owed vs held', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Reserves')
  await expect(page.getByText('Mock data, not read from a chain')).toBeVisible()
  await expect(page.getByRole('region', { name: 'USDx reserves' })).toContainText('Fully backed')
  await expect(page.getByRole('heading', { level: 1, name: /Owed equals held/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'USDx reserves' }).getByRole('img', { name: /held/i })).toBeVisible()
  await expect(page.getByText('How to verify this yourself')).toBeVisible()
  await expect(page.getByText(/not a guarantee against issuer action/)).toBeVisible()
})

test('issuer console asks to connect the issuer account', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Issuer')
  await expect(page.getByText(/Connect the asset issuer's account/)).toBeVisible()
  await expect(page.getByText(/Demo environment on Stellar Testnet/)).toBeVisible()
})
