import { downloadText } from '../lib/download';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ExportButtonProps {
  label: string;
  filename: string;
  /** Text built on click (large exports are not materialised until asked for). */
  build: () => string;
  mime?: string;
  title?: string;
}

/** One small download button (CSV, JSON, YAML): the same control wherever an export lives. */
export function ExportButton({ label, filename, build, mime = 'text/csv', title }: ExportButtonProps) {
  return (
    <Button type="button" size="sm" title={title ?? `Download ${filename}`} onClick={() => downloadText(filename, build(), mime)} leftIcon={<Icon name="download" className="h-3.5 w-3.5" />}>
      {label}
    </Button>
  );
}
