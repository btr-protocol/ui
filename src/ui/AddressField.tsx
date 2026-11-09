import { addNotification } from '../lib/notifications';
import { type Address, checksumAddress, isAddress } from '../lib/address';
import { cn } from '../lib/cn';
import { useId } from 'preact/hooks';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';

export type AddressCheck = { ok: true; value: Address } | { ok: false; error: string };

/** Empty input is `null` (nothing to judge). A MIXED-case address must equal its EIP-55
 *  spelling: that is the typo detector; all-lower and all-upper carry no checksum and pass. */
export function checkAddress(raw: string): AddressCheck | null {
  const v = raw.trim();
  if (!v) return null;
  if (/\.eth$/i.test(v)) return { ok: false, error: "ENS isn't resolved. Paste the 0x address." };
  if (!isAddress(v)) return { ok: false, error: 'Expected 0x followed by 40 hex characters.' };
  const sum = checksumAddress(v);
  const body = v.slice(2);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  return mixed && sum !== v
    ? { ok: false, error: 'Checksum mismatch: check for a typo.' }
    : { ok: true, value: sum };
}

/** `0x12 34ab …` in 4-char groups; `bold` marks the first and last 6 characters, the part a
 *  reader actually compares. */
export function addressGroups(a: string): { text: string; bold: boolean }[][] {
  const groups: { text: string; bold: boolean }[][] = [];
  for (let i = 0; i < a.length; i += 4) {
    const seg: { text: string; bold: boolean }[] = [];
    for (let j = i; j < Math.min(i + 4, a.length); j++) {
      const bold = j < 6 || j >= a.length - 6;
      const last = seg[seg.length - 1];
      if (last?.bold === bold) last.text += a[j];
      else seg.push({ text: a[j], bold });
    }
    groups.push(seg);
  }
  return groups;
}

export function AddressField({
  value,
  onChange,
  label,
  placeholder = '0x…',
  disabled,
  className,
  labels,
}: {
  value: string;
  /** The raw text plus its verdict, so the parent never re-validates. */
  onChange: (raw: string, check: AddressCheck | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Button texts, for a translated host. */
  labels?: { paste?: string; clear?: string };
}) {
  const id = useId();
  const check = checkAddress(value);
  const set = (raw: string) => onChange(raw, checkAddress(raw));
  const paste = async () => {
    try {
      set((await navigator.clipboard.readText()).trim());
    } catch {
      addNotification('warning', 'Clipboard blocked. Long-press the field to paste.');
    }
  };
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      {label && (
        <label htmlFor={id} className="text-xs text-fg-3">
          {label}
        </label>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            size="sm"
            variant="address"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            enterkeyhint="done"
            aria-invalid={check?.ok === false}
            aria-describedby={`${id}-msg`}
            className="pr-8"
            onInput={(e) => set((e.target as HTMLInputElement).value)}
          />
          {value && !disabled && (
            <button
              type="button"
              aria-label={labels?.clear ?? 'Clear address'}
              onClick={() => set('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-fg-3 hover:text-fg-0"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" disabled={disabled} onClick={paste}>
          {labels?.paste ?? 'Paste'}
        </Button>
      </div>
      <div id={`${id}-msg`} aria-live="polite" className="text-xs">
        {check?.ok === false ? (
          <span className="text-red">{check.error}</span>
        ) : check ? (
          <span className="flex flex-wrap gap-x-1.5 font-mono text-fg-3" title={check.value}>
            {addressGroups(check.value).map((g, i) => (
              <span key={i}>
                {g.map((s, j) => (
                  <span key={j} className={s.bold ? 'font-semibold text-fg-1' : undefined}>
                    {s.text}
                  </span>
                ))}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
