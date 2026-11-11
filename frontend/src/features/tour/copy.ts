// Every word of the guide's notes. The welcome on Markets and the entry that starts the guide again use the
// shared words in `core/guide` (GUIDE_COPY).
//
// The title of a note is the label its control or its heading carries on screen, so the text stands without the
// mark around the control. A note says what the control beside it does and nothing else: no risk statement, no
// required disclosure, no claim about an instrument. Sentence case, no directional words.

export const INTENTS_NOTE = {
  title: 'What do you want to do?',
  body: 'Each row is one thing you can do here, and says whether you pay or are paid. Pick one, then choose the asset in the Assets list.',
} as const

export const ASSETS_NOTE = {
  title: 'Assets',
  body: "Each asset with its reference price, the number of open offers and the nearest deadline. Trade opens that asset's page.",
} as const

export const MODE_NOTE = {
  title: 'Guided and Chain',
  body: 'Guided asks what you want and shows the best offer for it. Chain lists every strike and deadline with its best offer and request. Your choice is remembered.',
} as const

export const NAV_NOTE = {
  title: 'Where things are',
  terms: [
    { term: 'Portfolio', text: 'Your options, each with its deadline and what it needs from you.' },
    { term: 'Requests', text: 'Buyers whose payment is locked in, waiting for a maker.' },
    { term: 'Reserves', text: 'The collateral the contract holds, token by token.' },
    // The fifth tab exists on phones only.
    { term: 'More', text: 'Learn, Activity, Settings and this guide.', phoneOnly: true },
  ],
} as const

/** The wallet control of a guest. */
export const WALLET_NOTE = {
  title: 'Connect wallet',
  body: 'You can read everything without a wallet. Connect one when you want to trade: you review each order here, then sign it in your wallet.',
} as const

/** The same control once a wallet is connected. */
export const WALLET_MENU_NOTE = {
  title: 'Wallet menu',
  body: 'Your address, your balances, and Activity: the transactions made from this browser. Disconnect is here too.',
} as const

/** Small print on the last note of a tour: where the guide lives afterwards. */
export const CLOSING_LINE = 'This guide stays in Settings.'
export const CLOSING_LINE_PHONE = 'This guide stays under More.'

export const NEXT = 'Next'
export const BACK = 'Back'
export const DONE = 'Done'
export const CLOSE_LABEL = 'Close guide'

/** The count on a note: `2 of 4`. */
export const countText = (index: number, total: number): string => `${index} of ${total}`
/** Read before the count by a screen reader, where the bare figures would have no subject. */
export const COUNT_SUBJECT = 'Note'

/** A title as a sentence: a title that already ends a sentence keeps its own mark. */
const sentence = (text: string): string => (/[.?]$/.test(text) ? text : `${text}.`)

/** What a screen reader hears when Next or Back shows another note (focus stays on the same button). */
export function stepAnnouncement(index: number, total: number, title: string, spoken: string): string {
  return `${COUNT_SUBJECT} ${countText(index, total)}. ${sentence(title)} ${spoken}`
}

/** What a screen reader hears when the note on the mode switch opens by itself (it does not take focus). */
export function soloAnnouncement(title: string, spoken: string): string {
  return `${COUNT_SUBJECT}. ${sentence(title)} ${spoken} Press Escape to close.`
}

export const GUIDE_CLOSED = 'Guide closed.'
