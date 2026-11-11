import type { contract } from '@stellar/stellar-sdk'
import { config } from '../config'

// Shapes the Freighter hook exposes: useFreighter() returns address, sign, signAuthEntry.
export interface WalletSigner {
  address: string | null
  sign: (xdr: string) => Promise<string>
  signAuthEntry?: (entryXdr: string) => Promise<string>
}

type ClientSigning = Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry' | 'publicKey'>

// Wallet failures are returned as `error` (the shape contract.Client expects) so the SDK
// raises them and errors.ts can decode the message.
function walletError(e: unknown) {
  return { message: e instanceof Error ? e.message : String(e), code: -4 }
}

// Options for contract.Client: { publicKey, signTransaction, signAuthEntry }.
export function clientSigning(wallet: WalletSigner): ClientSigning {
  const signAuth = wallet.signAuthEntry
  return {
    publicKey: wallet.address ?? undefined,
    signTransaction: async (xdr) => {
      try {
        return { signedTxXdr: await wallet.sign(xdr), signerAddress: wallet.address ?? undefined }
      } catch (e) {
        return { signedTxXdr: '', error: walletError(e) }
      }
    },
    signAuthEntry: signAuth
      ? async (entry) => {
          try {
            return { signedAuthEntry: await signAuth(entry), signerAddress: wallet.address ?? undefined }
          } catch (e) {
            return { signedAuthEntry: '', error: walletError(e) }
          }
        }
      : undefined,
  }
}

// Spread into contract.Client / Client.from options together with clientSigning(wallet).
export const baseClientOptions = {
  rpcUrl: config.rpcUrl,
  networkPassphrase: config.networkPassphrase,
}

// Sign + submit an AssembledTransaction (signing goes through the signTransaction the
// client was built with) and wait for confirmation. Returns the tx hash.
export async function signAndSend<T>(tx: contract.AssembledTransaction<T>): Promise<{ hash: string; result: T }> {
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (!hash) throw new Error('Transaction was submitted but no hash was returned')
  return { hash, result: sent.result }
}
