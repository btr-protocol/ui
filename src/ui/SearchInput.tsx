import type { JSX, Ref } from 'preact';
import type { InputProps } from './Input';
import { SearchField } from './SearchField';

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
 * The established name, kept: `boxed` is `SearchField` boxed, `bare` is `SearchField` modal (see SearchField.tsx: the ONE search
 * implementation). Modal headers (`BaseModal` `headerType="input"`), lists and `Table` render this.
 */
export function SearchInput({ variant = 'boxed', ...props }: SearchInputProps) {
  return <SearchField {...props} variant={variant === 'bare' ? 'modal' : 'boxed'} />;
}
