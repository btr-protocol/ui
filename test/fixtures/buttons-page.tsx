// Page for test/buttons.browser.test.tsx and the renders: the ONE Button in three sizes x four forms x variants x states, in a
// button group, and in a SectionBar at several container widths (collapse).
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Button, type ButtonSize } from '../../src/ui/Button';
import { ButtonGroup } from '../../src/ui/ButtonGroup';
import { Icon } from '../../src/ui/Icon';
import { SectionBar, SectionBarCell } from '../../src/ui/SectionBar';

const SIZES: ButtonSize[] = ['xs', 'sm', 'md'];
const FORMS = ['text', 'prefix', 'postfix', 'icon'] as const;
const VARIANTS: { id: string; variant: 'primary' | 'secondary' | 'ghost'; tone?: 'danger' }[] = [
  { id: 'primary', variant: 'primary' },
  { id: 'secondary', variant: 'secondary' },
  { id: 'ghost', variant: 'ghost' },
  { id: 'danger', variant: 'secondary', tone: 'danger' },
];
const STATES = ['rest', 'disabled', 'loading', 'active'] as const;

function Cell({ size, form, v, state }: { size: ButtonSize; form: (typeof FORMS)[number]; v: (typeof VARIANTS)[number]; state: (typeof STATES)[number] }) {
  const common = { size, variant: v.variant, tone: v.tone, disabled: state === 'disabled', loading: state === 'loading', active: state === 'active' };
  const id = `${size}-${form}-${v.id}-${state}`;
  return (
    <span data-cell={id} data-size={size} data-form={form} data-variant={v.id} data-state={state} className="inline-flex">
      {form === 'text' && <Button {...common}>Export</Button>}
      {form === 'prefix' && <Button {...common} icon={<Icon name="download" />}>Export</Button>}
      {form === 'postfix' && <Button {...common} icon={<Icon name="arrow-right" />} iconPosition="end">Next</Button>}
      {form === 'icon' && <Button {...common} icon={<Icon name="refresh-cw" />} aria-label="Refresh" />}
    </span>
  );
}

function Matrix() {
  return (
    <div id="matrix" className="space-y-4">
      {SIZES.map((size) => (
        <div key={size}>
          <h3 className="mb-1 text-xs font-semibold uppercase text-fg-3">size {size}</h3>
          <div className="grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: 'repeat(4, max-content)' }}>
            {VARIANTS.map((v) => STATES.map((state) => (
              <div key={`${v.id}-${state}`} className="flex items-center gap-2" style={{ gridColumn: 'span 1' }}>
                {FORMS.map((form) => <Cell key={form} size={size} form={form} v={v} state={state} />)}
              </div>
            )))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BarCells({ n }: { n: string }) {
  return (
    <SectionBar title="Pools" label={`Pool actions ${n}`}
      end={<>
        <SectionBarCell><Button variant="ghost" size="sm" icon={<Icon name="refresh-cw" />} aria-label="Refresh" /></SectionBarCell>
        <SectionBarCell><Button variant="ghost" size="sm" icon={<Icon name="download" />} collapse={1} aria-label="Export">Export</Button></SectionBarCell>
        <SectionBarCell><Button variant="ghost" size="sm" icon={<Icon name="funnel" />} collapse={2} aria-label="Filters">Filters</Button></SectionBarCell>
        <SectionBarCell><Button variant="ghost" size="sm" icon={<Icon name="gear" />} collapse={3} aria-label="Columns">Columns</Button></SectionBarCell>
        <SectionBarCell><Button variant="primary" size="sm" icon={<Icon name="plus" />}>New pool</Button></SectionBarCell>
      </>} />
  );
}

function InBar() {
  return (
    <div id="inbar" className="space-y-3">
      {[800, 600, 480, 380].map((w) => (
        <div key={w} id={`bar-${w}`} style={{ width: w }} className="surface bg-bg-1 border border-border rounded-lg overflow-hidden">
          <BarCells n={String(w)} />
          <p className="px-3 py-2 text-xs text-fg-2">container {w}px</p>
        </div>
      ))}
    </div>
  );
}

function InGroup() {
  const [loading, setLoading] = useState(false);
  return (
    <div id="ingroup" className="space-y-3">
      {[420, 150].map((w) => (
        <div key={w} id={`group-${w}`} style={{ width: w }}>
          <ButtonGroup aria-label="Actions">
            <Button variant="ghost" size="sm" icon={<Icon name="copy" />} aria-label="Copy link" />
            <Button variant="ghost" size="sm" icon={<Icon name="plus" />} aria-label="Add" />
            <Button variant="ghost" size="sm">Cancel proposal</Button>
            <Button variant="ghost" size="sm" icon={<Icon name="refresh-cw" />}>Re-simulate</Button>
            <Button variant="primary" size="sm" loading={loading} onClick={() => setLoading((x) => !x)}>Sign</Button>
          </ButtonGroup>
        </div>
      ))}
    </div>
  );
}

document.head.append(Object.assign(document.createElement('style'), { textContent: 'html,body{height:auto;overflow:visible}' }));
render(
  <main style={{ padding: 16, width: '100%', maxWidth: 1700, margin: '0 auto' }} className="space-y-6">
    <section><h2 className="mb-2 text-sm font-semibold text-fg-0">Matrix</h2><Matrix /></section>
    <section><h2 className="mb-2 text-sm font-semibold text-fg-0">In a SectionBar (container 800 / 600 / 480 / 380)</h2><InBar /></section>
    <section><h2 className="mb-2 text-sm font-semibold text-fg-0">In a ButtonGroup (420 / 150)</h2><InGroup /></section>
  </main>,
  document.body,
);
