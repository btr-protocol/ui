import { cn } from '../lib/cn';
import { TIP_BODY } from './InfoBox';

export const PAGE_DESC = 'text-sm text-fg-2 max-w-md';

export const SECTION_TITLE = 'flex items-center gap-2 text-fg-0 font-semibold';

export const MONO_META = 'font-mono text-xs text-fg-2';

export const TIP_PANEL_SM = cn(TIP_BODY, 'w-56 space-y-1');

export const TIP_PANEL_SM_RELAXED = cn(TIP_BODY, 'w-56 space-y-2');

export const TIP_PANEL_MD = cn(TIP_BODY, 'w-60 space-y-1');

export const TIP_PANEL_MD_PY = cn(TIP_BODY, 'w-60 space-y-1 py-1');

export const TIP_PANEL_LG = cn(TIP_BODY, 'w-64 space-y-1.5');
