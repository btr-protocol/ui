/** Chain marks bundled with the kit (color SVG, plus a solid `-mono` variant for CSS masks).
 *  Resolved by the consumer's bundler via `new URL(..., import.meta.url)`. */

const COLOR = {
  'anvil': new URL('../assets/networks/anvil.svg', import.meta.url).href,
  'arbitrum': new URL('../assets/networks/arbitrum.svg', import.meta.url).href,
  'arc': new URL('../assets/networks/arc.svg', import.meta.url).href,
  'avalanche': new URL('../assets/networks/avalanche.svg', import.meta.url).href,
  'base': new URL('../assets/networks/base.svg', import.meta.url).href,
  'bnb-chain': new URL('../assets/networks/bnb-chain.svg', import.meta.url).href,
  'ethereum': new URL('../assets/networks/ethereum.svg', import.meta.url).href,
  'hyperevm': new URL('../assets/networks/hyperevm.svg', import.meta.url).href,
  'monad': new URL('../assets/networks/monad.svg', import.meta.url).href,
  'optimism': new URL('../assets/networks/optimism.svg', import.meta.url).href,
  'polygon': new URL('../assets/networks/polygon.svg', import.meta.url).href,
  'robinhood': new URL('../assets/networks/robinhood.svg', import.meta.url).href,
  'x-layer': new URL('../assets/networks/x-layer.svg', import.meta.url).href,
} as const;

const MONO = {
  'anvil': new URL('../assets/networks/anvil-mono.svg', import.meta.url).href,
  'arbitrum': new URL('../assets/networks/arbitrum-mono.svg', import.meta.url).href,
  'arc': new URL('../assets/networks/arc-mono.svg', import.meta.url).href,
  'avalanche': new URL('../assets/networks/avalanche-mono.svg', import.meta.url).href,
  'base': new URL('../assets/networks/base-mono.svg', import.meta.url).href,
  'bnb-chain': new URL('../assets/networks/bnb-chain-mono.svg', import.meta.url).href,
  'ethereum': new URL('../assets/networks/ethereum-mono.svg', import.meta.url).href,
  'hyperevm': new URL('../assets/networks/hyperevm-mono.svg', import.meta.url).href,
  'monad': new URL('../assets/networks/monad-mono.svg', import.meta.url).href,
  'optimism': new URL('../assets/networks/optimism-mono.svg', import.meta.url).href,
  'polygon': new URL('../assets/networks/polygon-mono.svg', import.meta.url).href,
  'robinhood': new URL('../assets/networks/robinhood-mono.svg', import.meta.url).href,
} as const;

export type ChainSlug = keyof typeof COLOR;

/** EVM chain id -> icon slug. A testnet wears its mainnet's mark. */
export const CHAIN_ICON_SLUG: Record<number, ChainSlug> = {
  1: 'ethereum', 11155111: 'ethereum', 17000: 'ethereum',
  10: 'optimism', 11155420: 'optimism',
  56: 'bnb-chain', 97: 'bnb-chain',
  137: 'polygon', 80002: 'polygon',
  143: 'monad', 10143: 'monad',
  196: 'x-layer',
  999: 'hyperevm',
  4663: 'robinhood',
  5042: 'arc', 5042002: 'arc',
  8453: 'base', 84532: 'base',
  42161: 'arbitrum', 421614: 'arbitrum',
  43114: 'avalanche', 43113: 'avalanche',
  31337: 'anvil',
};

/** Icon slug for a chain id or a slug; `undefined` when the kit carries no mark for it. */
export function chainSlug(chain: number | string): ChainSlug | undefined {
  if (typeof chain === 'number') return CHAIN_ICON_SLUG[chain];
  if (/^\d+$/.test(chain)) return CHAIN_ICON_SLUG[Number(chain)];
  return chain in COLOR ? (chain as ChainSlug) : undefined;
}

/** URL of a chain's mark (chain id, numeric string or slug). `mono` = solid mask variant, falling
 *  back to the color mark when a chain has none. `undefined` for an unknown chain. */
export function chainIcon(chain: number | string, opts: { mono?: boolean } = {}): string | undefined {
  const slug = chainSlug(chain);
  if (!slug) return undefined;
  return opts.mono ? ((MONO as Record<string, string>)[slug] ?? COLOR[slug]) : COLOR[slug];
}
