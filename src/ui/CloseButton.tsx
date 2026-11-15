import { Button } from './Button';
import { Icon } from './Icon';

interface CloseButtonProps {
  onClick: (e: MouseEvent) => void;
  className?: string;
  /** Name the thing being closed ("Close settings"); a bare "Close" is the fallback. */
  'aria-label'?: string;
  disabled?: boolean;
}

/** The close glyph is the kit Button, ghost + icon-only (a real 32 / 44 target, the same inset as every icon button). */
export function CloseButton({ onClick, className, 'aria-label': ariaLabel = 'Close', disabled }: CloseButtonProps) {
  return <Button variant="ghost" size="sm" icon={<Icon name="x" />} aria-label={ariaLabel} onClick={onClick} disabled={disabled} className={['border-0', className]} />;
}
