// Scene list for the demo video. Keep in sync with docs/demo-script.md (draft by Dev 3 for Dev 1 review).
export interface Scene {
  id: string
  title: string
  /** Target start time in the 3:00 video, in seconds. */
  start: number
}

export const SCENES: readonly Scene[] = [
  { id: 'problem', title: '1. The problem: tokenized assets without risk tools', start: 0 },
  { id: 'write', title: '2. Maker A writes a cash-secured PUT, collateral locked on-chain', start: 20 },
  { id: 'compete', title: '3. Maker B competes with a cheaper funded offer', start: 45 },
  { id: 'buy', title: '4. Investor buys the cheaper option (premium to the maker)', start: 60 },
  { id: 'exercise', title: '5. Exercise: atomic delivery-versus-payment', start: 80 },
  { id: 'claim', title: '6. Writer claims the delivered asset', start: 110 },
  { id: 'issuer', title: '7. Issuer freezes the holder: exercise fails (limitation)', start: 125 },
  { id: 'collateral', title: '8. Collateral panel: full backing, clawback warning', start: 155 },
  { id: 'close', title: '9. What is real, what is fictional', start: 170 },
]

/** Pure navigation: clamps to the list bounds. */
export function stepScene(index: number, delta: number, count: number = SCENES.length): number {
  if (count <= 0) return 0
  return Math.min(count - 1, Math.max(0, index + delta))
}
