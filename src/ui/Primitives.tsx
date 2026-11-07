import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { Panel } from './Panel';

export { Panel } from './Panel';
export type { PanelProps, PanelVariant } from './Panel';

export type FormRowGap = 'xs' | 'sm' | 'md' | 'lg';

const FORM_ROW_GAP: Record<FormRowGap, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export interface FormRowProps {
  label: ComponentChildren;
  value?: ComponentChildren;
  children?: ComponentChildren;
  gap?: FormRowGap;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function FormRow({
  label,
  value,
  children,
  gap,
  className,
  labelClassName,
  valueClassName,
}: FormRowProps) {
  return (
    <div className={cn('flex items-center justify-between', gap && FORM_ROW_GAP[gap], className)}>
      <span className={cn('min-w-0', labelClassName)}>{label}</span>
      <span className={cn('shrink-0 text-right', valueClassName)}>{value ?? children}</span>
    </div>
  );
}

export interface InfoRowCompactProps {
  label: string | ComponentChildren;
  value: string | ComponentChildren;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function InfoRowCompact({
  label,
  value,
  className,
  labelClassName = 'text-fg-3',
  valueClassName = 'text-fg-0',
}: InfoRowCompactProps) {
  return (
    <FormRow
      className={cn('px-1 text-sm', className)}
      labelClassName={labelClassName}
      valueClassName={cn('font-numeric', valueClassName)}
      label={label}
      value={value}
    />
  );
}

export function InfoSection({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ComponentChildren;
  className?: string;
}) {
  return (
    <Panel variant="plain" title={title} className={className}>
      {children}
    </Panel>
  );
}
