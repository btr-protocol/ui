/** Protocol marks: the DeFi protocol a holding sits in (Aave, Venus, Morpho, Euler, Fluid, Wombat, Wombex, Merkl, BTR…).
 *  Protocols that have a token mark reuse the bundled token raster; the rest ship in `assets/protocols` (96px WebP). */
import { tokenIcon } from './tokenIcon';

const OWN: Record<string, string> = {
  euler: new URL('../assets/protocols/euler.webp', import.meta.url).href,
  fluid: new URL('../assets/protocols/fluid.webp', import.meta.url).href,
  wombat: new URL('../assets/protocols/wombat.webp', import.meta.url).href,
  wombex: new URL('../assets/protocols/wombex.webp', import.meta.url).href,
  merkl: new URL('../assets/protocols/merkl.webp', import.meta.url).href,
};
/** keyword in the normalised protocol name -> bundled token mark (or own asset key). */
const RULES: [RegExp, string][] = [
  [/^aave/, 'aave'], [/^morpho/, 'morpho'], [/^compound/, 'comp'], [/^venus/, 'xvs'], [/^curve/, 'crv'], [/^pendle/, 'pendle'],
  [/^lido/, 'ldo'], [/^(sky|maker)/, 'sky'], [/^uniswap/, 'uni'], [/^(aerodrome|velodrome)/, 'aero'], [/^pancake/, 'cake'], [/^(btr|bc-)/, 'btr'],
  [/^euler/, 'euler'], [/^fluid/, 'fluid'], [/^wombex/, 'wombex'], [/^wombat/, 'wombat'], [/^merkl/, 'merkl'], [/^ethena/, 'ena'],
];

/** Normalised key of a protocol name ("Aave V3" -> "aave v3"). */
const norm = (name: string) => name.trim().toLowerCase();

/** Mark URL for a protocol name, undefined when the kit has none (the caller falls back to a monogram, or a wallet glyph for plain wallet balances). */
export function protocolIcon(name: string): string | undefined {
  const n = norm(name);
  for (const [re, key] of RULES) if (re.test(n)) return OWN[key] ?? tokenIcon(key);
  return undefined;
}
