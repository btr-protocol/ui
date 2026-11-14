import { cn } from '../lib/cn';
import { Icon } from './Icon';

interface CloseButtonProps {
  onClick: (e: MouseEvent) => void;
  size?: number;
  className?: string;
  /** Name the thing being closed ("Close settings"); a bare "Close" is the fallback. */
  'aria-label'?: string;
  disabled?: boolean;
}

export function CloseButton({
  onClick,
  size = 18,
  className,
  'aria-label': ariaLabel = 'Close',
  disabled,
}: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('opacity-70 hover:opacity-100 transition-opacity', className)}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      <Icon name="x" size={size} />
    </button>
  );
}
