import { WALLETS } from '@btr-protocol/sdk/eth/wallets';
import { Tooltip } from '../ui/FloatingPanel';
import { PageState } from '../ui/Feedback';
import { WalletGlyph } from './WalletGlyph';
import { WC_TILE_IDS } from './walletSections';

const NAME = new Map(WALLETS.map((w) => [w.id, w.name]));

/** The WalletConnect entry: the wallets it reaches as a blurred 6x4 grid behind the WalletConnect mark; hover (or focus) clears the blur and grows the tile. */
export function WalletConnectTile({
  name,
  caption,
  loading,
  highlighted,
  onClick,
  expanded,
  controls,
  loadingLabel,
}: {
  name: string;
  caption: string;
  loading: boolean;
  highlighted: boolean;
  onClick: () => void;
  expanded: boolean;
  /** Id of the QR block the tile opens. */
  controls: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${name}. ${caption}`}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-busy={loading}
      onClick={onClick}
      className={`group w-full relative overflow-hidden border-b border-border transition-all duration-500 ease-in-out h-[130px] hover:h-[260px] focus-visible:h-[260px] ${highlighted ? 'bg-bg-3' : 'bg-bg-2'}`}
    >
      <span className={`block p-3 transition-all duration-500 ease-in-out ${loading ? 'opacity-20 blur-[2px]' : 'opacity-40 blur-[1.5px] group-hover:blur-0 group-hover:opacity-100 group-focus-visible:blur-0 group-focus-visible:opacity-100'}`}>
        <span aria-hidden="true" className="grid grid-cols-6 gap-2">
          {WC_TILE_IDS.map((id) => (
            <Tooltip key={id} content={NAME.get(id) ?? id} side="top" wrapClass="block aspect-square [&>span]:!h-full [&>span]:!w-full">
              <WalletGlyph id={id} name={id} bare />
            </Tooltip>
          ))}
        </span>
      </span>
      <span className={`absolute inset-0 bg-bg-2 pointer-events-none transition-opacity duration-500 ease-in-out ${loading ? 'opacity-70' : 'opacity-50 group-hover:opacity-0 group-focus-visible:opacity-0'}`} />
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ease-in-out ${loading ? '' : 'group-hover:opacity-0 group-focus-visible:opacity-0'}`}>
        {loading ? (
          <PageState kind="loading" message={loadingLabel} className="py-0" />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 256 156" className="h-14 text-fg-0 opacity-90" fill="currentColor">
            <path d="M52.409 30.48c41.748-40.64 109.435-40.64 151.183 0l5.024 4.89a5.105 5.105 0 0 1 0 7.36l-17.187 16.73a2.725 2.725 0 0 1-3.78 0l-6.914-6.73c-29.125-28.351-76.345-28.351-105.47 0l-7.404 7.208a2.724 2.724 0 0 1-3.78 0L46.894 43.206a5.106 5.106 0 0 1 0-7.358zm186.728 34.602 15.297 14.89a5.105 5.105 0 0 1 0 7.359l-68.975 67.145c-2.087 2.032-5.472 2.032-7.559 0l-48.955-47.655a1.36 1.36 0 0 0-1.889 0l-48.954 47.655c-2.087 2.032-5.472 2.032-7.56 0L1.567 87.33a5.106 5.106 0 0 1 0-7.358L16.863 65.08c2.087-2.032 5.471-2.032 7.559 0l48.955 47.655a1.36 1.36 0 0 0 1.89 0l48.953-47.655c2.087-2.032 5.471-2.032 7.559 0l48.955 47.655a1.36 1.36 0 0 0 1.89 0l48.954-47.654c2.088-2.032 5.472-2.032 7.559 0" />
          </svg>
        )}
      </span>
    </button>
  );
}
