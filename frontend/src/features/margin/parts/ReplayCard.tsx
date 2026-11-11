import { useId, useState } from 'react'
import { FIXTURE_DEFAULT_PARTY } from '../../../core/pro/createClient'
import { proErrorName } from '../../../core/pro/errors'
import type { HistoryEntry } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { Button, Card, IconChevronLeft, IconChevronRight, Select, Slider, useIsPhone } from '../../../ui'
import { callName, partyName, scenarioCopy } from '../model/names'
import { DeskTable } from './DeskTable'
import type { DeskColumn } from './DeskTable'
import css from './ReplayCard.module.css'

/** Steps of the log shown once "Show steps" is pressed, latest first. */
const RECENT = 12

const STEP_COLUMNS: ReadonlyArray<DeskColumn<HistoryEntry>> = [
  { id: 'step', header: 'Step', numeric: true, cell: (h) => h.index + 1 },
  { id: 'call', header: 'Call', rowHeader: true, phone: 'title', cell: (h) => callName(h.op) },
  { id: 'account', header: 'Account', cell: (h) => (h.actor ? partyName(h.actor) : 'Anyone') },
  {
    id: 'result',
    header: 'Result',
    phone: 'aside',
    cell: (h) => (h.ok ? 'Done' : <span className={css.refused}>Refused: {proErrorName(h.code ?? 0)} ({h.code ?? 0})</span>),
  },
]

/**
 * Fixture builds only: which recorded scenario is replayed, at which step, and as which account. It is a tool
 * beside the product, so it sits last on the page, on the sunken ground, and starts collapsed on phones. This is
 * the one place that says how a replayed action works; a result says which step ran.
 */
export function ReplayCard() {
  const { sim, model, me, setMe } = usePro()
  const phone = useIsPhone()
  const [chosen, setChosen] = useState<boolean | null>(null)
  const [steps, setSteps] = useState(false)
  const bodyId = useId()
  const stepsId = useId()
  if (!sim) return null

  const open = chosen ?? !phone
  const copy = scenarioCopy(sim.scenarioName)
  const at = sim.position
  const total = sim.stepCount
  const scenario = sim.file.scenarios.find((s) => s.name === sim.scenarioName)
  const next = scenario?.steps[at]
  const nextActor = next && typeof next.args[0] === 'string' && /^[A-Z][A-Z0-9_]*$/.test(next.args[0]) ? partyName(next.args[0]) : null
  const recent = model.history.slice(-RECENT).reverse()

  return (
    <Card
      as="section"
      tone="sunken"
      id="replay"
      className={css.root}
      title="Replay a scenario"
      headingLevel={2}
      actions={
        <Button size="sm" variant="quiet" aria-expanded={open} aria-controls={bodyId} onClick={() => setChosen(!open)}>
          {open ? 'Hide controls' : 'Show controls'}
        </Button>
      }
    >
      {open ? null : (
        <p className={css.summary}>
          <span className={css.scenario}>{copy.title}</span>, step {at} of {total}, as {partyName(me)}.
        </p>
      )}
      <div id={bodyId} className={css.body} hidden={!open}>
        <p className={css.lead}>A button on the page runs the next recorded step of its kind, with that step's amounts.</p>
        <div className={css.controls}>
          <div className={css.control}>
            <Select
              label="Scenario"
              value={sim.scenarioName}
              onValueChange={(name) => {
                sim.setScenario(name)
                // The acting account must exist in the scenario: fall back to its first writer, else its first party.
                if (!sim.parties.includes(me)) setMe(sim.parties.includes(FIXTURE_DEFAULT_PARTY) ? FIXTURE_DEFAULT_PARTY : (sim.parties[0] ?? me))
              }}
              options={sim.scenarioNames.map((name) => ({ value: name, label: scenarioCopy(name).title }))}
              hint={copy.summary || undefined}
            />
          </div>
          <div className={css.control}>
            <Slider label="Step" value={at} min={0} max={total} step={1} largeStep={5} valueText={(v) => `${v} of ${total}`} onValueChange={(v) => sim.moveTo(v)} />
            <div className={css.stepper}>
              <Button size="sm" iconStart={<IconChevronLeft />} disabled={at === 0} disabledReason="This is the start of the scenario." onClick={() => sim.moveTo(at - 1)}>
                Back
              </Button>
              <Button size="sm" iconEnd={<IconChevronRight />} disabled={at >= total} disabledReason="This is the end of the scenario." onClick={() => sim.moveTo(at + 1)}>
                Next
              </Button>
              <span className={css.next}>
                {next ? (
                  <>
                    Next: {callName(next.op).toLowerCase()}
                    {nextActor ? `, by ${nextActor}` : ''}
                  </>
                ) : (
                  'End of the scenario'
                )}
              </span>
            </div>
          </div>
          <div className={css.control}>
            <Select
              label="Acting as"
              value={me}
              onValueChange={(party) => setMe(party)}
              options={sim.parties.map((party) => ({ value: party, label: partyName(party) }))}
            />
          </div>
        </div>
        <div className={css.recent}>
          <div className={css.recentHead}>
            <h3 className={css.recentTitle}>Recent steps</h3>
            <Button size="sm" variant="quiet" aria-expanded={steps} aria-controls={stepsId} onClick={() => setSteps(!steps)}>
              {steps ? 'Hide steps' : 'Show steps'}
            </Button>
          </div>
          <div id={stepsId} hidden={!steps}>
            {steps ? (
              <DeskTable
                caption="Recent steps of the scenario, latest first"
                columns={STEP_COLUMNS}
                rows={recent}
                rowKey={(h) => h.index}
                empty={<p className={css.none}>No step has run yet. Press Next to start the scenario.</p>}
              />
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
