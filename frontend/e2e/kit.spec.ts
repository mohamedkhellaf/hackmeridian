// The ui kit's own behaviour, on the /design gallery: keyboard, touch and phone rules that every feature inherits.
// Feature specs test the flows; this spec tests the components under them.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openApp } from './helpers'

const openGallery = (page: Page) => openApp(page, '/design')

test.describe('ui kit', () => {
  test('Tab moves from one exact-value figure to the next without stopping in a popup or on the page body', async ({ page }) => {
    await openGallery(page)
    const figures = page.getByRole('button', { name: /show the exact value$/ })
    await expect(figures.first()).toBeVisible()
    await figures.first().focus()
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE')
      expect(tag).not.toBe('BODY')
    }
    // Focus alone opens nothing; a press does.
    await figures.first().focus()
    await expect(page.getByText('Exact value', { exact: true })).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Exact value' })).toBeVisible()
  })

  test('a comma before three digits groups thousands, a comma before fewer is the decimal point, an exponent is refused', async ({ page }) => {
    await openGallery(page)
    const qty = page.getByRole('textbox', { name: /^Quantity/ }).first()
    await qty.fill('')
    await qty.pressSequentially('1,000')
    await expect(qty).toHaveValue('1,000')
    await qty.blur()
    await expect(qty).toHaveValue('1000')
    await qty.fill('1,5')
    await qty.blur()
    await expect(qty).toHaveValue('1.5')
    await qty.fill('1e3')
    await expect(qty).toHaveValue('1.5')
  })

  test('in forced-colours mode a focused field still draws an outline', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await openGallery(page)
    const qty = page.getByRole('textbox', { name: /^Quantity/ }).first()
    await qty.focus()
    const ring = await qty.evaluate((el) => {
      const box = el.parentElement
      if (!box) return null
      const cs = getComputedStyle(box)
      return { style: cs.outlineStyle, width: cs.outlineWidth }
    })
    expect(ring).toEqual({ style: 'solid', width: '2px' })
  })

  test('empty states are plain unless they stand for a missing contract note', async ({ page }) => {
    await openGallery(page)
    await expect(page.getByRole('heading', { name: 'No open offers on BOND.' })).toBeVisible()
    // One blank slip in the specimen, with its serial line; the plain one has none.
    await expect(page.getByText('No. ------', { exact: true })).toHaveCount(1)
  })

  test('a disabled button says why on a tap @phone', async ({ page }) => {
    await openGallery(page)
    const buy = page.getByRole('button', { name: 'Buy for 1.80 USDx', description: 'Connect a wallet to buy.' })
    await buy.scrollIntoViewIfNeeded()
    // The button is aria-disabled, which Playwright's own tap waits on: tap the screen where it is, as a finger does.
    const box = await buy.boundingBox()
    if (!box) throw new Error('The disabled button is not on screen.')
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByText('Connect a wallet to buy.', { exact: true }).filter({ visible: true })).toBeVisible()
  })

  test('a dialog is a bottom sheet on a phone @phone', async ({ page }) => {
    await openGallery(page)
    const open = page.getByRole('button', { name: 'Open a short dialog' })
    await open.scrollIntoViewIfNeeded()
    await open.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      return box ? Math.round(box.y + box.height) : 0
    }).toBe(844)
    const box = await dialog.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(390)
  })
})
