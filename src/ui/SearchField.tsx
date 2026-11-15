// THE search input of the kit: ONE core (input + magnifier + clear + accessible name + optional debounce + keys) and
// three thin presentations. Every search in the kit renders through it: modal headers (BaseModal `headerType="input"`,
// so wallet / settings / select / command palette), master lists and selection lists, `Table`, and the SectionBar cell.
//   bar     a cell of a SectionBar: the bar supplies the box, the corner, the divider and the focus tone
//   modal   a modal / list header: the header supplies the chrome (no box)
//   boxed   standalone, only where no bar and no modal header exists: its own border and radius
// No focus ring anywhere: the caret and a background change on focus-within (the hover tone) say where focus is.
// Keys: Escape clears a typed query and keeps focus, Escape on an empty field blurs it (bar / boxed); in a modal Escape is the
// modal's own (it closes), so `modal` leaves it alone.
import type { JSX, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';
import { Input, type InputProps } from './Input';
import { Spinner } from './Spinner';

export type SearchFieldVariant = 'bar' | 'modal' | 'boxed';

export interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Accessible name (default: the placeholder). */
  ariaLabel?: string;
  variant?: SearchFieldVariant;
  /** A query is pending (a server search the user just typed): the kit `Spinner` shows before the clear button, the input is `aria-busy`. */
  busy?: boolean;
  /** ms: `onChange` fires this long after the last keystroke (clear is immediate). Default: every keystroke. */
  debounce?: number;
  onKeyDown?: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Modal headers stop propagation so a nested modal does not also see the event. */
  stopPropagation?: boolean;
  className?: string;
  inputProps?: Partial<InputProps>;
}

const CLEAR_ICON = <Icon name="x" className="h-3 w-3" />;

/** What each presentation adds to the same markup. */
const SHELL: Record<SearchFieldVariant, string> = {
  bar: 'h-full w-full px-3',
  modal: 'w-full',
  boxed: 'h-[var(--ctl-m)] w-[var(--search-w)] max-w-full px-3 rounded-sm border border-border bg-bg-2 transition-colors focus-within:bg-bg-3',
};

export function SearchField({ value, onChange, placeholder = 'Search...', ariaLabel, variant = 'boxed', debounce = 0, busy = false, onKeyDown, inputRef, stopPropagation = false, className, inputProps }: SearchFieldProps) {
  const fallback = useRef<HTMLInputElement>(null);
  const ref = (inputRef ?? fallback) as Ref<HTMLInputElement>;
  const el = () => (ref as { current: HTMLInputElement | null }).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]); // a change from outside (a reset button, the URL) wins
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = debounce ? typed : value;

  const push = (v: string) => {
    clearTimeout(timer.current);
    if (!debounce || v === '') {
      setTyped(v);
      onChange(v);
    } else {
      setTyped(v);
      timer.current = setTimeout(() => onChange(v), debounce);
    }
  };
  const stop = (e: Event) => stopPropagation && e.stopPropagation();

  return (
    <div className={cn('relative flex items-center gap-2 min-w-0', SHELL[variant], className)} data-search-field={variant}>
      <Icon name="magnifying-glass" className="h-4 w-4 shrink-0 text-fg-2" />
      <Input
        ref={ref}
        type="text"
        variant="bare"
        size="sm"
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          stop(e);
          push((e.target as HTMLInputElement).value);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key !== 'Escape' || e.defaultPrevented || variant === 'modal') return;
          if (shown) {
            e.preventDefault();
            e.stopPropagation();
            push('');
          } else {
            el()?.blur();
          }
        }}
        aria-label={ariaLabel ?? placeholder}
        aria-busy={busy || undefined}
        className="min-w-0 flex-1 placeholder:text-fg-2"
        // Preact-flavoured intrinsic attrs (autocomplete, spellcheck) on a compat-typed component: the DOM takes them, the two prop tables differ.
        {...(inputProps as InputProps)}
      />
      {busy && <Spinner />}
      {shown && (
        <Tooltip content="Clear" side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            data-search-clear=""
            aria-label="Clear search"
            leftIcon={CLEAR_ICON}
            onClick={(e) => {
              stop(e);
              push('');
              el()?.focus();
            }}
          />
        </Tooltip>
      )}
    </div>
  );
}
