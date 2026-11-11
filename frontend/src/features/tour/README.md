# `src/features/tour`: the welcome guide

Four short notes, each beside the control it explains and titled with that control's own label. The guide starts
only when the visitor asks: the welcome on Markets ("Show me around"), or the same words in Settings (from 768 px)
and under More (phones). One note is the exception: the note on the Guided / Chain switch opens once by itself on
the first asset page, and only for a visitor who started the tour.

It never dims or blocks the page, never navigates, never advances on a timer, and never comes back by itself
after it was answered. A press anywhere outside a note ends the tour and still does what it was for.

## How the pieces talk

No feature imports this folder (features do not import each other). Everything goes through `useGuide()` of
`src/data`:

| Who | File | Call |
|---|---|---|
| The welcome on Markets | `features/markets/index-page/GuideSlip.tsx` | `start('tour', 'slip')`, `decline()` |
| Settings menu, More sheet | `features/shell/GuideEntry.tsx` | `start('tour', 'replay')` |
| Asset page, Trade tab | `features/markets/asset/AssetTabs.tsx` through `useModeNoteOffer` | `start('mode', 'auto')` when `canOpenModeNote` |
| This folder | `Guide.tsx` | reads `run`; calls `shown(id)` when a note is on screen and `end(run)` when it closes |
| The mount | `src/app/GuideMount.tsx` | loads this chunk the first time `run` is set |

## Files

| File | What |
|---|---|
| `index.tsx` | Public: `GuideHost` |
| `Guide.tsx` | The runner: start, the note on screen, Next and Back, the five ways out, focus, announcements |
| `notes.ts` | The five notes as data: anchor, words, placement, the phone and wallet variants |
| `copy.ts` | Every word of the notes. The welcome's words are `GUIDE_COPY` in `core/guide` |
| `engine.ts` | Pure: `notesFor` (layout and wallet variants), `present` (notes whose control is on screen), `reconcile` (which note when a control leaves), `spoken` |
| `dom.ts` | The only file that asks the document: `findAnchor`, `overlayOpen`, `inViewport`, `reveal`, `restoreFocus` |
| `Guide.module.css` | The definition list of the navigation note |

The note itself is the kit's `Coachmark` (`src/ui`): a non-modal dialog on a Base UI popover without a trigger.

## The notes

| Anchor (`data-tour`) | On which element | On screen |
|---|---|---|
| `intents` | the "What do you want to do?" `section` of `MarketsIndexPage` | Markets |
| `assets` | the "Assets" `section` of `MarketsIndexPage` | Markets |
| `mode` | the wrapper of the Guided / Chain switch in `AssetTabs` | an asset page, Trade tab |
| `nav` | `nav[aria-label="Main"]` of `TopBar`; on phones the `nav` of `TabBar` (`{ ring: 'inset' }`) | every app page |
| `wallet` | the "Connect wallet" button of `WalletButton`; once connected, the trigger of `WalletMenu` | every app page |

A tour shows the notes whose control is on screen now and numbers them from that list: four on Markets, three on
an asset page, two anywhere else. A component writes its anchor with `{...guideAnchor('nav')}` (`core/guide`).
**A control that is renamed, moved or removed takes its anchor with it.** What fails otherwise: `notes.test.ts`
(every note has a known anchor; Markets has the four the welcome's sentence promises) and `e2e/guide.spec.ts`
(the titles and the count on each route).

## Rules the runner keeps

- **Start**: by a press only. It waits until no menu, dialog, drawer, sheet or list box is open and no
  transaction is in flight, for at most 3 s; then it gives up and records nothing.
- **Count**: "2 of 4", from the notes present. A note whose control is missing or hidden is left out.
- **Placement**: beside the control. On phones the two tall groups dock their note above the tab bar while the
  mark stays on the group. From 768 px the intents note sits under the end of the list, clear of the Assets
  heading. The mode note sits above the switch from 768 px, so it never lies on the order panel.
- **Where the guide lives**: said once, as small print on the last note of a tour ("Show me around is in the
  settings menu, top right." / "under More" on phones). The welcome leaves no line behind.
- **Ways out**: Done, the close button, Escape (from anywhere), a click or tap outside, a change of page, or the
  loss of every control. Focus goes back to what had it before; if that is gone, and always for a tour started
  from the welcome (whose button goes when the tour starts), to the element the page marks `data-tour-return`
  (the intents heading on Markets); else to the page heading. After a press outside it stays on what was pressed.
- **The mode note by itself**: never takes focus, never scrolls the page, is announced politely, and is dropped
  without a record when the address carries an order ticket, the switch is not in the viewport, something else
  is open or a transaction is in flight.
- **Storage**: `stellsec.guide.v1`, `{"tour":1,"mode":1}`; `0` means declined. Where storage is blocked there is
  no welcome and no note by itself; the replay entry still works. Raising `GUIDE_VERSION` never brings the
  welcome back.
- **Screen readers**: a note is a `dialog` named by its title and described by "Note 2 of 4" and its body; the
  control is described by the note while it is open; Next and Back announce the new note; the end announces
  "Guide closed.". Only `announce()` is used.

## End-to-end tests

Every spec but `e2e/guide.spec.ts` runs as a returning visitor: `playwright.config.ts` seeds
`{"tour":999,"mode":999}` through `storageState` (`e2e/guideState.ts`). A spec that wants a first visit uses
`test.use({ storageState: FIRST_VISIT })`.
