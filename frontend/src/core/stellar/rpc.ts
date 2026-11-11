import { rpc } from '@stellar/stellar-sdk'
import { config } from '../config'

// Single shared RPC server for the whole app (Testnet only).
export const server = new rpc.Server(config.rpcUrl)
