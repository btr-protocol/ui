// The barrel stays light: the two modals are lazy (`ConnectModalHost`, `WalletButton`) or imported by subpath
// (`@btr-protocol/ui/wallet/WalletModal`, `@btr-protocol/ui/wallet/AccountModal`), never from here.
export * from './wallet';
export { useProviders } from './useProviders';
export { useInjectedWallets, type WalletInfo } from './useInjectedWallets';
export { WalletButton } from './WalletButton';
export type { WalletModalProps, ConnectedWallet } from './WalletModal';
export type { AccountModalProps } from './AccountModal';
export { WalletGlyph } from './WalletGlyph';
export { ConnectModalHost } from './ConnectModalHost';
export { activateAccount, type ActivateOptions, type ActivateResult } from './accountSwitch';
export { AccountList, accountGate, type AccountGate, type AccountListProps } from './AccountPanel';
export {
  ACCOUNT_LABELS,
  WALLET_MODAL_LABELS,
  labelsFrom,
  type AccountLabels,
  type WalletModalLabels,
} from './labels';
export { connectError, useWalletConnection } from './connection';
export {
  WC_FLAG,
  configureWalletConnect,
  isWalletConnectProvider,
  loadWc,
  setWalletPeer,
  walletConnectConfig,
  walletConnectEnabled,
  walletPeer,
  type WalletConnectConfig,
  type WalletConnectProvider,
} from './walletConnectShell';
export * from './walletLink';
