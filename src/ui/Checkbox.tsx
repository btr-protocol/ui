import { cn } from '../lib/cn';
import type { FunctionalComponent } from 'preact';
import type { HTMLAttributes } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { Icon } from './Icon';

export interface CheckboxProps extends Omit<HTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox: FunctionalComponent<CheckboxProps> = ({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    onCheckedChange?.(target.checked);
  };

  return (
    <label className="tap-target relative inline-flex items-center">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'peer h-5 w-5 coarse:h-6 coarse:w-6 shrink-0 rounded-xs border border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'appearance-none cursor-pointer',
          'checked:bg-bg-primary checked:border-primary',
          className,
        )}
        {...props}
      />
      {checked && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center',
            disabled && 'opacity-50',
          )}
        >
          <Icon name="check" className="h-5 w-5 coarse:h-6 coarse:w-6 text-primary" />
        </div>
      )}
    </label>
  );
};

Checkbox.displayName = 'Checkbox';

export { Checkbox };
