// The public addresses of the project, in one place: the repository and the documents the interface links to
// (landing, app footer, Learn, Reserves). Pure constants: safe to import from the shell and the landing page.

/** The public repository. `public/llms.txt` states the same address. */
export const REPOSITORY_URL = 'https://github.com/mohamedkhellaf/hackmeridian'

const blob = (path: string): string => `${REPOSITORY_URL}/blob/main/${path}`
const tree = (path: string): string => `${REPOSITORY_URL}/tree/main/${path}`

/** Documents and sources a page may cite. Every address is on the `main` branch of the repository. */
export const DOC_LINKS = {
  repo: REPOSITORY_URL,
  /** What the instrument promises: PRODUCT_SPEC.md. */
  spec: blob('PRODUCT_SPEC.md'),
  /** The compiled interface of the Covered contract. */
  abi: blob('docs/contract-abi.md'),
  /** The recorded Testnet runs of the Covered contract, with transaction hashes. */
  evidence: blob('docs/contract-testnet-evidence.md'),
  /** The recorded Testnet run of the Margin contract. */
  marginEvidence: blob('docs/pro-testnet-evidence.md'),
  /** The Covered contract crate, with its tests. */
  tests: tree('contracts/options'),
  /** The Covered contract source. */
  source: blob('contracts/options/src/lib.rs'),
  ci: blob('.github/workflows/ci.yml'),
  /** The plain-text description of the site for language models, served by the app itself. */
  llms: '/llms.txt',
} as const

export type DocLink = keyof typeof DOC_LINKS
