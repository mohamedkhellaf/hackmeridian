import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import {
  FOOTER_NAV,
  PRIMARY_NAV,
  SECTIONS,
  actionsWaitingLabel,
  containsSection,
  moreNav,
  nextMenuIndex,
  secondaryNav,
  sectionOf,
} from './nav'

describe('the navigation model', () => {
  it('puts Markets, Portfolio, Requests and Reserves in the bar, in that order', () => {
    expect(PRIMARY_NAV.map((entry) => entry.label)).toEqual(['Markets', 'Portfolio', 'Requests', 'Reserves'])
  })

  it('uses one word per tab', () => {
    for (const entry of PRIMARY_NAV) expect(entry.label).toMatch(/^[A-Z][a-z]+$/)
  })

  it('shows Margin only in a build that enables it', () => {
    expect(secondaryNav(true).map((entry) => entry.id)).toEqual(['learn', 'margin'])
    expect(secondaryNav(false).map((entry) => entry.id)).toEqual(['learn'])
    expect(moreNav(true).map((entry) => entry.id)).toEqual(['learn', 'margin', 'issuer', 'activity'])
    expect(moreNav(false).map((entry) => entry.id)).toEqual(['learn', 'issuer', 'activity'])
  })

  it('links the footer to Learn, Reserves and Issuer, and not to the component gallery', () => {
    expect(FOOTER_NAV.map((entry) => entry.to)).toEqual(['/learn', '/reserves', '/issuer'])
  })

  it('gives every section the path of its own id', () => {
    for (const [id, entry] of Object.entries(SECTIONS)) {
      expect(entry.id).toBe(id)
      expect(entry.to).toBe(`/${id}`)
    }
  })

  it('carries no qualifier tags and no banned wording in its labels', () => {
    const labels = Object.values(SECTIONS)
      .map((entry) => entry.label)
      .join(' ')
    expect(findBannedWords(labels, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(labels, BANNED_TAGLINES)).toEqual([])
    expect(labels.toLowerCase()).not.toContain('experimental')
  })
})

describe('sectionOf', () => {
  it('keeps a section current on its sub-pages', () => {
    expect(sectionOf('/markets')).toBe('markets')
    expect(sectionOf('/markets/bond')).toBe('markets')
    expect(sectionOf('/portfolio/12')).toBe('portfolio')
    expect(sectionOf('/margin/vault')).toBe('margin')
    expect(sectionOf('/design')).toBe('design')
  })

  it('ignores a trailing slash and doubled slashes', () => {
    expect(sectionOf('/requests/')).toBe('requests')
    expect(sectionOf('//reserves')).toBe('reserves')
  })

  it('is null outside the app sections', () => {
    expect(sectionOf('/')).toBeNull()
    expect(sectionOf('')).toBeNull()
    expect(sectionOf('/nowhere')).toBeNull()
    expect(sectionOf('/toString')).toBeNull()
    expect(sectionOf('/constructor')).toBeNull()
  })
})

describe('containsSection', () => {
  it('marks More as current on the pages it holds', () => {
    const more = moreNav(true)
    expect(containsSection(more, '/learn')).toBe(true)
    expect(containsSection(more, '/margin/trade')).toBe(true)
    expect(containsSection(more, '/issuer')).toBe(true)
    expect(containsSection(more, '/activity')).toBe(true)
  })

  it('does not mark More on a page that has its own tab, or on an unknown one', () => {
    const more = moreNav(true)
    expect(containsSection(more, '/markets')).toBe(false)
    expect(containsSection(more, '/portfolio/3')).toBe(false)
    expect(containsSection(more, '/design')).toBe(false)
    expect(containsSection(more, '/nowhere')).toBe(false)
  })

  it('does not mark More on Margin in a build without it', () => {
    expect(containsSection(moreNav(false), '/margin')).toBe(false)
  })
})

describe('actionsWaitingLabel', () => {
  it('uses the singular for one', () => {
    expect(actionsWaitingLabel(1)).toBe('1 action waiting')
  })

  it('uses the plural otherwise', () => {
    expect(actionsWaitingLabel(2)).toBe('2 actions waiting')
    expect(actionsWaitingLabel(12)).toBe('12 actions waiting')
  })
})

describe('nextMenuIndex', () => {
  it('moves down and wraps to the first item', () => {
    expect(nextMenuIndex('ArrowDown', 0, 4)).toBe(1)
    expect(nextMenuIndex('ArrowDown', 3, 4)).toBe(0)
  })

  it('moves up and wraps to the last item', () => {
    expect(nextMenuIndex('ArrowUp', 2, 4)).toBe(1)
    expect(nextMenuIndex('ArrowUp', 0, 4)).toBe(3)
  })

  it('starts from the ends when focus is not on an item yet', () => {
    expect(nextMenuIndex('ArrowDown', -1, 4)).toBe(0)
    expect(nextMenuIndex('ArrowUp', -1, 4)).toBe(3)
  })

  it('jumps with Home and End', () => {
    expect(nextMenuIndex('Home', 2, 4)).toBe(0)
    expect(nextMenuIndex('End', 1, 4)).toBe(3)
  })

  it('leaves every other key alone, and an empty list too', () => {
    expect(nextMenuIndex('Tab', 1, 4)).toBeNull()
    expect(nextMenuIndex('Enter', 1, 4)).toBeNull()
    expect(nextMenuIndex('ArrowDown', 0, 0)).toBeNull()
  })
})
