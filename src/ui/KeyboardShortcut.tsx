import { Badge } from './Badge';

/** Right-aligned hint row: one `Badge` key cap + label per shortcut. */
export function KeyboardShortcutGroup({
  shortcuts,
  className = '',
}: {
  shortcuts: Array<{ keys: string | string[]; label: string }>;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ml-auto ${className}`}>
      {shortcuts.map(({ keys, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-fg-2">
          <Badge variant="code">{[keys].flat().join('')}</Badge>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
