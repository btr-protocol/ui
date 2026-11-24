// The one scope/timeframe row under a page header: tabs left, scope selects right. Phones keep one
// row: the tabs take the width and the scope moves into a Filters sheet behind an icon button (the
// same controls, mounted once, one per row; they apply as they change, so Apply only closes it). The
// button counts the filters off their default; Reset puts them back. `sticky` pins it under the
// chrome on phones; its bleed reads the same --page-x as PageShell. Tabs are the page's section
// switch: segmented tabs, or on phones with more than PHONE_TABS sections (they cut to "O…", "Gu…")
// the modal SelectModal.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { usePhone } from '../lib/useMedia';
import { Badge } from '../ui/Badge';
import { BaseModal, MODAL_PADDING } from '../ui/BaseModal';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl';
import { SelectModal, type SelectModalItem } from '../ui/SelectModal';

const PHONE_TABS = 4;

/** Sections on a phone over PHONE_TABS render as a modal pick, so the page drops its `tabpanel` role. */
export const tabsArePick = (phone: boolean, n: number) => phone && n > PHONE_TABS;

export interface PageToolbarTabs<T extends string> {
  /** Names the switch and its panel (`panelId`). */
  label: string;
  panelId: string;
  /** Routes the phone pick sheet. */
  pickKey: string;
  options: (SegmentedOption<T> & SelectModalItem<T>)[];
  value: T;
  onChange: (v: T) => void;
}

export function PageToolbar<T extends string>({
  tabs: t,
  scope,
  active = 0,
  onReset,
  sticky = false,
  className,
}: {
  tabs?: PageToolbarTabs<T>;
  scope?: ComponentChildren;
  /** Filters off their default: the phone button's count. */
  active?: number;
  /** Puts every filter back to its default (the sheet's Reset). */
  onReset?: () => void;
  sticky?: boolean;
  className?: string;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const tabs =
    t &&
    (tabsArePick(phone, t.options.length) ? (
      <SelectModal items={t.options} value={t.value} onChange={t.onChange} label={t.label} routeKey={t.pickKey} />
    ) : (
      <SegmentedControl
        size="sm"
        aria-label={t.label}
        activation="manual"
        panelId={t.panelId}
        options={t.options}
        value={t.value}
        onChange={t.onChange}
      />
    ));
  const sheet = phone && !!tabs && !!scope;
  return (
    <div
      className={cn(
        'flex items-center gap-2',
        tabs ? 'sm:justify-between' : 'justify-end',
        sticky &&
          'sticky top-0 z-sticky -mx-[var(--page-x)] bg-bg-0 px-[var(--page-x)] py-2 sm:static sm:mx-0 sm:bg-transparent sm:p-0',
        className,
      )}
    >
      {tabs && (
        <div className="min-w-0 flex-1 sm:flex-none max-sm:[&>*]:w-full max-sm:[&_[role=tab]]:flex-auto">{tabs}</div>
      )}
      {sheet ? (
        <>
          <Button
            size="sm"
            aria-label={active ? `Filters, ${active} set` : 'Filters'}
            title="Filters"
            leftIcon={<Icon name="funnel" />}
            onClick={() => setOpen(true)}
          >
            {active ? <Badge variant="primary">{active}</Badge> : null}
          </Button>
          <BaseModal
            isOpen={open}
            onClose={() => setOpen(false)}
            title="Filters"
            size="sm"
            footerControls={
              <>
                {/* Always there, so the footer never changes shape; off while nothing is set. */}
                <Button size="sm" variant="secondary" disabled={!active || !onReset} onClick={onReset}>
                  Reset
                </Button>
                <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
                  Apply
                </Button>
              </>
            }
          >
            {/* One control per row, full width (each scope control carries its own label). */}
            <div className={`flex flex-col gap-3 ${MODAL_PADDING} py-3 [&>*]:w-full`}>{scope}</div>
          </BaseModal>
        </>
      ) : (
        scope && <div className="flex flex-wrap items-center gap-2">{scope}</div>
      )}
    </div>
  );
}
