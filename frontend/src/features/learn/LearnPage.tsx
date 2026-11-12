import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { nowSec } from '../../core/time'
import { ButtonLink, Callout, PageHeader } from '../../ui'
import { LIFECYCLE_TERMS, deadlineText as deadlineTextOf, exampleDeadline, workedExample, workedExamples } from './examples'
import {
  NOTHING_SETTLES_TEXT,
  NOTHING_SETTLES_TITLE,
  PAGE_TITLE,
  REQUESTS_LINK,
  REQUESTS_TEXT,
  REQUESTS_TITLE,
  RESALE_TEXT,
  RESALE_TITLE,
  RULES,
  RULES_CAPTION,
  RULES_HEAD,
  RULES_NOTE,
  RULES_TITLE,
  SECTIONS,
  SIDES,
  SIDES_CAPTION,
  SIDES_HEAD,
  SIDES_TITLE,
  WHAT_THIS_IS,
  intentsIntro,
  lifecycleIntro,
  sectionHeadingId,
} from './content'
import type { SectionId } from './content'
import { Glossary } from './Glossary'
import { IntentExample } from './IntentExample'
import { Lifecycle } from './Lifecycle'
import { ProseTable } from './ProseTable'
import { Questions } from './Questions'
import { Risks } from './Risks'
import { SectionNav } from './SectionNav'
import { useActiveSection } from './useActiveSection'
import css from './LearnPage.module.css'

const SECTION_IDS: readonly SectionId[] = SECTIONS.map((section) => section.id)
const isSectionId = (value: string): value is SectionId => (SECTION_IDS as readonly string[]).includes(value)
const titleOf = (id: SectionId) => SECTIONS.find((section) => section.id === id)?.title ?? ''
const numberOf = (id: SectionId) => SECTION_IDS.indexOf(id) + 1

/** Scrolls a section to the top of the view and puts focus on its heading, so reading continues from there. */
function showSection(id: SectionId): void {
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
  document.getElementById(sectionHeadingId(id))?.focus({ preventScroll: true })
}

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  return (
    <section id={id} className={css.section}>
      <h2 id={sectionHeadingId(id)} className={css.heading} tabIndex={-1}>
        <span className={css.number} aria-hidden="true">
          {numberOf(id)}
        </span>
        <span>{titleOf(id)}</span>
      </h2>
      {children}
    </section>
  )
}

/**
 * Learn: what an option is here, the life of one, the four things a user can do with exact figures, requests and
 * resale, what can go wrong, a glossary and questions. A document, not a dashboard: it reads no chain data, so it
 * has no loading, empty or guest state of its own.
 */
export function LearnPage() {
  const navigate = useNavigate()
  const [active, setActive] = useActiveSection(SECTION_IDS)
  const deadline = useMemo(() => exampleDeadline(nowSec()), [])
  const deadlineText = deadlineTextOf(deadline)
  const examples = useMemo(() => workedExamples(), [])
  const put = useMemo(() => workedExample(LIFECYCLE_TERMS), [])

  const jump = useCallback(
    (id: SectionId) => {
      setActive(id)
      showSection(id)
      // Recorded in the URL so the section can be linked to; `replace` keeps Back for leaving the page.
      void navigate({ to: '/learn', hash: id, replace: true, resetScroll: false })
    },
    [navigate, setActive],
  )

  // A link straight to a section (`/learn#glossary`): start reading there. A link to a glossary term
  // (`/learn#term-breakeven`) scrolls the term into view.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const frame = requestAnimationFrame(() => {
      if (isSectionId(id)) showSection(id)
      else document.getElementById(id)?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={css.page}>
      <PageHeader title={PAGE_TITLE} />
      <div className={css.layout}>
        <SectionNav sections={SECTIONS} active={active} onJump={jump} />
        <div className={css.article}>
          <Section id="what-this-is">
            <div className={css.standfirst}>
              {WHAT_THIS_IS.map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
            </div>
            <div className={css.block}>
              <h3 className={css.subheading}>{RULES_TITLE}</h3>
              <ProseTable
                caption={RULES_CAPTION}
                head={[RULES_HEAD.rule, RULES_HEAD.text]}
                rows={RULES.map((row) => ({ header: row.rule, cells: [row.text] }))}
              />
              <p className={css.note}>{RULES_NOTE}</p>
            </div>
          </Section>

          <Section id="lifecycle">
            <p className={css.prose}>{lifecycleIntro(put)}</p>
            <Lifecycle example={put} deadline={deadlineText} />
            <Callout className={css.callout} variant="warning" title={NOTHING_SETTLES_TITLE}>
              {NOTHING_SETTLES_TEXT}
            </Callout>
            <div className={css.block}>
              <h3 className={css.subheading}>{SIDES_TITLE}</h3>
              <ProseTable
                caption={SIDES_CAPTION}
                first="wide"
                head={[SIDES_HEAD.row, SIDES_HEAD.put, SIDES_HEAD.call]}
                rows={SIDES.map((row) => ({ header: row.step, cells: [row.put, row.call] }))}
              />
            </div>
          </Section>

          <Section id="intents">
            <p className={css.prose}>{intentsIntro(put, deadlineText)}</p>
            <div className={css.examples}>
              {examples.map((example, i) => (
                <IntentExample key={example.intent} example={example} deadline={deadline} deadlineText={deadlineText} defaultOpen={i === 0} />
              ))}
            </div>
          </Section>

          <Section id="requests-resale">
            <div className={css.columns}>
              <div className={css.column}>
                <h3 className={css.subheading}>{REQUESTS_TITLE}</h3>
                {REQUESTS_TEXT.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                <p className={css.action}>
                  <ButtonLink variant="secondary" render={<RouterLink to="/requests" />}>
                    {REQUESTS_LINK}
                  </ButtonLink>
                </p>
              </div>
              <div className={css.column}>
                <h3 className={css.subheading}>{RESALE_TITLE}</h3>
                {RESALE_TEXT.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </div>
          </Section>

          <Section id="risks">
            <Risks />
          </Section>

          <Section id="glossary">
            <Glossary />
          </Section>

          <Section id="questions">
            <Questions />
          </Section>
        </div>
      </div>
    </div>
  )
}
