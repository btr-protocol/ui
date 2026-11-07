export interface NavItem {
  /** Route path handed to `onNavigate`; also what `activePath` is matched against. */
  path: string;
  title: string;
  description?: string;
  /** Tab bar glyph: a registered Icon name, or an svg path/URL (starts with `/`, `.` or `http`). */
  icon?: string;
}

/** Active when the current path is, or sits under, the item's path. */
export const isNavActive = (activePath: string, itemPath: string): boolean =>
  activePath.startsWith(itemPath);
