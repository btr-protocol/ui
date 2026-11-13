import type { JSX, Ref } from 'preact';
import { useRef } from 'preact/hooks';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';
import { Input, type InputProps } from './Input';

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * `bare` is the modal-header form: no box, the modal's own header supplies
   * the chrome. `boxed` is the standalone page form.
   */
  variant?: 'boxed' | 'bare';
  onKeyDown?: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Modal headers stop propagation so a nested modal does not also see it. */
  stopPropagation?: boolean;
  ariaLabel?: string;
  className?: string;
  inputProps?: Partial<InputProps>;
}

/**
 * THE search input: one magnifier, one clear affordance, one set of metrics. Modal headers
 * (`BaseModal` `headerType="input"`) and `Table` render this.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  variant = 'boxed',
  onKeyDown,
  inputRef,
  stopPropagation = false,
  ariaLabel,
  className,
  inputProps,
}: SearchInputProps) {
  const fallbackRef = useRef<HTMLInputElement>(null);
  const ref = (inputRef ?? fallbackRef) as Ref<HTMLInputElement>;

  const handle = (e: Event) => {
    if (stopPropagation) e.stopPropagation();
    onChange((e.target as HTMLInputElement).value);
  };

  return (
    <div className={`relative flex items-center gap-2 min-w-0 ${className ?? ''}`}>
      <Icon
        name="magnifying-glass"
        className={`w-4 h-4 text-fg-2 shrink-0 ${
          variant === 'boxed' ? 'absolute left-3 pointer-events-none z-raised' : ''
        }`}
      />
      <div className="relative flex-1 min-w-0">
        <Input
          ref={ref}
          type="text"
          variant={variant === 'bare' ? 'bare' : 'default'}
          size="sm"
          placeholder={placeholder}
          value={value}
          onChange={handle}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel ?? placeholder}
          className={`w-full pr-7 touch:min-h-11 ${variant === 'boxed' ? 'pl-9' : ''}`}
          // Preact-flavoured intrinsic attrs (autocomplete, spellcheck) on a
          // compat-typed component: the DOM takes them, the two prop tables differ.
          {...(inputProps as InputProps)}
        />
        {value && (
          <Tooltip content="Clear" side="bottom">
            <button
              type="button"
              onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
                onChange('');
                (ref as { current: HTMLInputElement | null }).current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 touch:min-h-11 touch:min-w-11 touch:inline-flex touch:items-center touch:justify-center hover:bg-bg-3 rounded-sm text-fg-2 hover:text-fg-0 transition-colors"
              aria-label="Clear search"
            >
              <Icon name="x" className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
