/**
 * The welcome guide and the end-to-end suite.
 *
 * A browser that has the guide's mark in storage never sees the welcome on Markets or the note that opens by
 * itself on an asset page. `playwright.config.ts` seeds that mark for every context, so every spec, also one that
 * calls `page.goto` directly, runs as a returning visitor and none had to change when the guide was added.
 * `guide.spec.ts` is the one spec that starts without it: `test.use({ storageState: FIRST_VISIT })`.
 */
import type { Locator, Page } from '@playwright/test'

/** The key of `src/data/guide.ts` (`GUIDE_STORAGE_KEY`). Retyped here so the config imports no app code. */
export const GUIDE_KEY = 'stellsec.guide.v1'

/** Far above any content version the app will reach: a returning visitor for good. */
export const GUIDE_SEEN_VALUE = '{"tour":999,"mode":999}'

/** A storage state in which the guide has been seen, for the app served at `origin`. */
export const guideSeen = (origin: string) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: GUIDE_KEY, value: GUIDE_SEEN_VALUE }] }],
})

/** An empty storage state: a first visit. */
export const FIRST_VISIT = { cookies: [], origins: [] }

// --- Locators for specs that look at the guide ---------------------------------------------------------------

/** The welcome on Markets, found by its heading. */
export const guideSlip = (page: Page): Locator => page.getByRole('heading', { name: 'Welcome to StellSec.' })
/** The guide's note, while one is open. */
export const guideNote = (page: Page): Locator => page.locator('[data-coachmark]')
/** The control the open note is about: it carries the ruled mark. */
export const ringed = (page: Page): Locator => page.locator('[data-coach-target]')
