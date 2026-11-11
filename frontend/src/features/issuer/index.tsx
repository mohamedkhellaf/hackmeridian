// The Issuer route (`/issuer`). The router lazy-loads the named export `IssuerPage`.
import { useOptionsClient } from '../../data'
import { IssuerConsoleView } from './IssuerConsoleView'
import { MockIssuer } from './MockIssuer'
import { useIssuerConsole } from './useIssuerConsole'

function LiveIssuer() {
  const model = useIssuerConsole()
  return <IssuerConsoleView model={model} />
}

/**
 * The issuer console. A build without a Testnet contract can read nothing and sign nothing, so it shows what the
 * console does instead of a console full of dead controls.
 */
export function IssuerPage() {
  const { isMock } = useOptionsClient()
  return isMock ? <MockIssuer /> : <LiveIssuer />
}
