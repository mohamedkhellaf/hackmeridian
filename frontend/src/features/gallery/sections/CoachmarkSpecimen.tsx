import { useRef, useState } from 'react'
import { Button, Coachmark, IconRefresh } from '../../../ui'
import { Specimen } from '../Specimen'

/** The guide's note on a control of the page: the ruled mark on the control, the note beside it. */
export function CoachmarkSpecimen() {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<HTMLButtonElement | null>(null)
  const done = useRef<HTMLButtonElement | null>(null)
  return (
    <Specimen
      title="Coachmark"
      note="A note beside a control it did not create, for a guide someone asked for. Not modal: no scrim and no scroll lock, the control gets a ruled mark, and a press outside closes the note and still lands. Escape closes it from anywhere."
    >
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Show the note
      </Button>
      <Button ref={setTarget} variant="quiet" iconStart={<IconRefresh />}>
        Refresh balances
      </Button>
      <Coachmark
        open={open}
        target={target}
        counter="1 of 1"
        title="Refresh balances"
        closeLabel="Close note"
        onClose={() => setOpen(false)}
        initialFocus={done}
        actions={
          <Button ref={done} variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        Reads the balances of the connected wallet again. Nothing is signed.
      </Coachmark>
    </Specimen>
  )
}
