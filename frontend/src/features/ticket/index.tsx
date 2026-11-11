// Public API of the order ticket: the one component every page mounts to buy, write, bid, fill, buy a resale
// listing or list a position. Other features import this file and nothing else from this folder.
//
//   <TicketHost placement="rail" intent={intent} onClose={close} onIntentChange={change} idle={<Idle />} />
//
// placement 'rail' (asset page only): an inline panel from 1200 px, a right drawer from 768 to 1199 px, a full
// page with a sticky action bar on phones; with a null intent it renders `idle` in the rail and nothing below
// 1200 px. placement 'overlay' (any other page): a right drawer from 768 px, a full page on phones; nothing
// when the intent is null. `sides={false}` hides the Buy, Write and Request tabs where the page already chooses
// the side (the asset page's guided mode).
export type { TicketIntent } from './intent'
// The contract puts the two URL mappers beside the component. A barrel is never edited live, so fast refresh loses nothing.
// oxlint-disable-next-line react/only-export-components
export { ticketIntentFromSearch, searchFromTicketIntent } from './intent'
export { TicketHost } from './TicketHost'
