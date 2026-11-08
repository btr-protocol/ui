import { type ComponentChildren, type JSX, createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';

type Source = 'plot' | 'legend' | 'row';
interface Selection {
  key: string;
  seriesId?: string;
}
interface Hover extends Selection {
  source: Source;
}
type Channel = 'pointer' | 'focus' | 'touch';
type Selections = Record<Channel, Hover | null>;
interface SeriesHoverState {
  active: Hover | null;
  setActive: (hover: Selection | null, source: Source, channel?: Channel) => void;
  bindings: (
    selection: Selection,
    source: Source,
  ) => Pick<
    JSX.HTMLAttributes<HTMLElement>,
    'tabIndex' | 'onPointerEnter' | 'onPointerLeave' | 'onPointerUp' | 'onFocus' | 'onBlur'
  >;
}
const Context = createContext<SeriesHoverState | null>(null);
const same = (a: Hover | null, b: Hover) =>
  a?.key === b.key && a.seriesId === b.seriesId && a.source === b.source;

function useHoverState(): SeriesHoverState {
  const [state, setState] = useState<Selections>({ pointer: null, focus: null, touch: null });
  const setActive: SeriesHoverState['setActive'] = (next, source, channel = 'pointer') =>
    setState((prev) => {
      const current = prev[channel];
      // A delayed canvas leave must not erase a newer legend/row hover.
      if (!next) return current?.source === source ? { ...prev, [channel]: null } : prev;
      const value = { ...next, source };
      if (channel === 'touch') {
        return { pointer: null, focus: null, touch: same(current, value) ? null : value };
      }
      if (channel === 'focus') return { ...prev, pointer: null, focus: value };
      return same(current, value) ? prev : { ...prev, [channel]: value };
    });
  return {
    active: state.pointer ?? state.focus ?? state.touch,
    setActive,
    bindings: (selection, source) => ({
      tabIndex: 0,
      onPointerEnter: (e) => {
        if (e.pointerType !== 'touch') setActive(selection, source);
      },
      onPointerLeave: (e) => {
        if (e.pointerType !== 'touch') setActive(null, source);
      },
      onPointerUp: (e) => {
        if (e.pointerType === 'touch') setActive(selection, source, 'touch');
      },
      onFocus: () => setActive(selection, source, 'focus'),
      onBlur: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setActive(null, source, 'focus');
      },
    }),
  };
}

/** One hover identity per chart/table pair; it never crosses a grid row. */
export function SeriesHover({ children }: { children: ComponentChildren }) {
  return <Context.Provider value={useHoverState()}>{children}</Context.Provider>;
}

export function useSeriesHover() {
  const linked = useContext(Context);
  const local = useHoverState();
  return linked ?? local;
}

export const SERIES_HIGHLIGHT = 'bg-bg-3 hover:bg-bg-3 text-fg-0';
