import { haptic } from '../lib/haptic';
import { cn } from '../lib/cn';
import type { FunctionalComponent } from 'preact';
import type { HTMLAttributes } from 'preact/compat';
import { useRef } from 'preact/hooks';

export interface SwitchProps extends Omit<HTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Switch: FunctionalComponent<SwitchProps> = ({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    haptic('tap');
    onCheckedChange?.(target.checked);
  };

  return (
    // <label>: the tap-target overlay hit-tests to its host, so the host must forward to the input.
    <label className="tap-target relative inline-flex items-center">
      <input
        ref={inputRef}
        type="checkbox"
        role="switch"
        {...props}
        aria-checked={checked}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'peer h-5 w-9 coarse:h-7 coarse:w-12 shrink-0 cursor-pointer rounded-full',
          'border border-line transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'appearance-none',
          'bg-bg-2 checked:border-ring checked:bg-bg-primary',
          className,
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute left-0.5 coarse:left-1 block h-4 w-4 coarse:h-5 coarse:w-5 rounded-full',
          'transition-all translate-x-0 peer-checked:translate-x-4 coarse:peer-checked:translate-x-6',
          'bg-line peer-checked:bg-ring',
          disabled && 'opacity-50',
        )}
      />
    </label>
  );
};

Switch.displayName = 'Switch';

export { Switch };
