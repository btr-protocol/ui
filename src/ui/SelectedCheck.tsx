import { cn } from '../lib/cn';
import { Icon } from './Icon';

/** THE selected mark of every list the kit renders (modal select, click menu, dropdown, multi rows): the `check` icon, one size
 *  (16 px), `text-primary`, trailing. Never restyle it per call site and never swap it for a glyph. */
export function SelectedCheck({ className }: { className?: string }) {
  return <Icon name="check" aria-hidden="true" data-selected-check="" className={cn('h-4 w-4 shrink-0 text-primary pointer-events-none', className)} />;
}
