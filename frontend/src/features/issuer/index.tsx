// The Issuer route (`/issuer`). The router lazy-loads the named export `IssuerPage`.
import { IssuerConsoleView } from './IssuerConsoleView'
import { useIssuerConsole } from './useIssuerConsole'

/**
 * The issuer console. On a Testnet build it reads the asset's issuer, flags and accounts, and the issuer signs
 * from it. On mock data nothing can be read from a network or signed, so it says so in one sentence and shows
 * only what the mock data holds, read only: the demo flags and what the Covered contract holds.
 */
export function IssuerPage() {
  const model = useIssuerConsole()
  return <IssuerConsoleView model={model} />
}
