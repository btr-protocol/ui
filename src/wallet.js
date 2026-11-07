// Wallet helpers for Sign-In with Ethereum (EIP-4361): EIP-6963 provider discovery, account request, personal_sign and a
// guard that refuses to sign a server-provided message that does not name this login. All wallet RPC goes through
// `@btr-protocol/sdk/eth/rpc` (zero-dependency EIP-1193 helpers); the legacy `window.ethereum` global is never read,
// and WalletConnect is deliberately not bundled (mobile works through wallet-app browsers, which inject EIP-1193).
import { requestAccounts, signMessage } from '@btr-protocol/sdk/eth/rpc'
import { isAddress } from '@btr-protocol/sdk/eth/types'

/** EIP-6963 discovery only: provider objects stay local and `window.ethereum` is never read. */
export function discoverProviders(timeoutMs = 400) {
  return new Promise((resolve) => {
    const found = new Map()
    const announce = (event) => {
      const detail = event.detail || {}
      if (typeof detail.info?.uuid === 'string' && typeof detail.info?.name === 'string' && typeof detail.provider?.request === 'function') found.set(detail.info.uuid || detail.info.name, detail)
    }
    window.addEventListener('eip6963:announceProvider', announce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', announce)
      resolve([...found.values()])
    }, timeoutMs)
  })
}

export async function connectProvider(entry) {
  const accounts = await requestAccounts(entry.provider)
  const address = (accounts || []).find((a) => typeof a === 'string' && isAddress(a))
  if (!address) throw new Error('no account authorized in the wallet')
  return { entry, address }
}

export function personalSign(entry, address, message) {
  return signMessage(entry.provider, address, message)
}

/**
 * Refuse to sign a server-provided SIWE (EIP-4361) message that does not name this login: the wallet must display
 * exactly what the operator authorises. The Host line is not asserted (a deployment's configured domain may differ).
 */
export function assertSiweMessage(message, wantAddress, { domain, statement, uri }) {
  const head = `${domain} wants you to sign in with your Ethereum account:`
  const lines = String(message || '').split('\n')
  if (lines[0] !== head) throw new Error('Refused to sign: foreign login message.')
  if ((lines[1] || '').toLowerCase() !== String(wantAddress).toLowerCase()) throw new Error('Refused to sign: address mismatch.')
  if (!String(message).includes(statement)) throw new Error('Refused to sign: unknown statement.')
  if (lines.find((l) => l.startsWith('URI: ')) !== `URI: ${uri}`) throw new Error('Refused to sign: foreign URI.')
}
