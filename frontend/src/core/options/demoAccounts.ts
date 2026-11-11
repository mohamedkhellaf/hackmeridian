// Fictional accounts of the mock demo. Plain public keys or obvious placeholders: there is no secret anywhere,
// nothing here exists on a network, and the test wallet signs nothing.

/** The two identities of the test wallet (VITE_E2E=1). Both have seeded positions in the mock market. */
export const DEMO_WALLETS = {
  /** Default identity. */
  a: 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG',
  /** Second identity: connect with `?as=<address>` in the URL. */
  b: 'GBPHYE7XMH6GWDVWVTB3V2N55I6GRFAEK6BPWVOH2RGKX3PMNA2VIEEM',
} as const

const placeholder = (prefix: string, fill: string) => prefix.padEnd(56, fill)

/** Four fictional makers. They read as `GMAK…AAAA` to `GMAK…DDDD` in the short form. */
export const DEMO_MAKERS = {
  a: placeholder('GMAKER', 'A'),
  b: placeholder('GMAKER', 'B'),
  c: placeholder('GMAKER', 'C'),
  d: placeholder('GMAKER', 'D'),
} as const

/** Two fictional counterparties that are neither makers nor test wallets (`GHED…AAAA`, `GHED…BBBB`). */
export const DEMO_HEDGERS = {
  a: placeholder('GHEDGER', 'A'),
  b: placeholder('GHEDGER', 'B'),
} as const
