import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, Select } from '../../ui'
import { NAV_LABEL, sectionHeadingId } from './content'
import type { SectionId, SectionInfo } from './content'
import css from './SectionNav.module.css'

/** How long after a choice the select is given a new identity (see below), once its list has closed. */
const RENEW_AFTER_MS = 500

export interface SectionNavProps {
  sections: readonly SectionInfo[]
  /** The section the reader is in. */
  active: SectionId
  /** Scrolls to a section, moves focus to its heading and records it in the URL. */
  onJump: (id: SectionId) => void
}

/**
 * The in-page navigation, twice: a list that stays in view beside the text from 1200 px, and below that a select
 * that stays at the top of the viewport and names the section being read. Only one of the two is displayed at any
 * width, so only one is in the accessibility tree.
 */
export function SectionNav({ sections, active, onJump }: SectionNavProps) {
  const follow = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    // A modified click keeps its browser meaning (new tab, new window).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onJump(id)
  }

  // After a choice the list closes and hands focus on. By default that is its trigger, away from the heading
  // `onJump` has just moved focus to; the kit's `finalFocus` sends it to the heading instead. The target is
  // cleared each time the list opens, so closing without a choice (Escape) returns to the trigger as usual.
  const heading = useRef<HTMLElement | null>(null)

  // Once a choice is done with, the select is given a new identity. The page changes its value as the reader
  // scrolls, and an instance that has made a choice opens, the next time, with the keyboard highlight on the item
  // chosen then, not on the selected one. A select that is open or has focus is left alone.
  const [generation, setGeneration] = useState(0)
  const selectRef = useRef<HTMLDivElement | null>(null)
  const renewal = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(renewal.current), [])

  const choose = (id: SectionId) => {
    heading.current = document.getElementById(sectionHeadingId(id))
    onJump(id)
    window.clearTimeout(renewal.current)
    renewal.current = window.setTimeout(() => {
      const select = selectRef.current
      const inUse = !select || select.contains(document.activeElement) || select.querySelector('[aria-expanded="true"]') !== null
      if (!inUse) setGeneration((n) => n + 1)
    }, RENEW_AFTER_MS)
  }

  return (
    <>
      <nav className={css.list} aria-label={NAV_LABEL}>
        <p className={css.title} aria-hidden="true">
          {NAV_LABEL}
        </p>
        <ol className={css.items} role="list">
          {sections.map((section, i) => (
            <li key={section.id}>
              <Link
                href={`#${section.id}`}
                tone="quiet"
                className={css.link}
                aria-current={active === section.id ? 'location' : undefined}
                onClick={follow(section.id)}
              >
                <span className={css.number} aria-hidden="true">
                  {i + 1}
                </span>
                <span>{section.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <div className={css.select} ref={selectRef}>
        <Select<SectionId>
          key={generation}
          label={NAV_LABEL}
          hideLabel
          value={active}
          onValueChange={choose}
          finalFocus={heading}
          onOpenChange={(open) => {
            if (open) heading.current = null
          }}
          options={sections.map((section, i) => ({ value: section.id, label: `${i + 1}. ${section.title}` }))}
        />
      </div>
    </>
  )
}
