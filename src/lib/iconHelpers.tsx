import type { IconType } from './uiTypes';
import { Icon } from '../ui/Icon';
import { MaskIcon } from '../ui/MaskIcon';

export type { IconType } from './uiTypes';

/** True for string icons (name or SVG path). */
export function isStringIcon(icon: IconType): icon is string {
  return typeof icon === 'string';
}

/** SVG path vs lucide icon name. */
export function isSvgPath(icon: string): boolean {
  return icon.includes('/') && icon.endsWith('.svg');
}

/** Renders an icon name (lucide), SVG path, or Preact node. */
export function renderIcon(icon: IconType | undefined, className?: string) {
  if (!icon) return null;

  if (typeof icon === 'string') {
    if (isSvgPath(icon)) {
      // MaskIcon, not <img>: an <img> paints the file's own fill (brand marks stay black in both
      // themes); masking tints with `currentColor` like the lucide branch.
      return <MaskIcon src={icon} className={className} color="currentColor" />;
    }
    return <Icon name={icon} className={className} />;
  }

  return icon;
}
