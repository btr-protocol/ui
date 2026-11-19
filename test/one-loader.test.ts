// ONE loader: ad-hoc skeletons, pulses and spinners-as-values are defects outside the primitive family.
import { expect, test } from 'bun:test';
import { Glob } from 'bun';

const files = [...new Glob('src/**/*.{ts,tsx,css}').scanSync('.')];
const read = (f: string) => Bun.file(f).text();
const scan = async (re: RegExp, allow: string[]) => {
  const bad: string[] = [];
  for (const f of files) {
    if (allow.some((a) => f === a)) continue;
    (await read(f)).split('\n').forEach((l, i) => re.test(l) && bad.push(`${f}:${i + 1}: ${l.trim()}`));
  }
  return bad;
};

test('no animate-pulse / animate-spin / hand-made shimmer outside the loader family', async () => {
  expect(await scan(/animate-pulse|animate-spin|\bsk\b(?!-)|loader-sweep|@keyframes (?!row-|modal-|sheet-)/, ['src/ui/Loaders.tsx', 'src/ui/Spinner.tsx', 'src/ui/Figure.tsx', 'src/styles/loaders.css', 'src/styles/index.css', 'src/styles/kit.css', 'src/styles/tokens.css'])).toEqual([]);
});

test('Spinner is for a user-initiated action (buttons, the wallet connect row, the action toast) or DataSpinner (a chart or data table)', async () => {
  expect(await scan(/<Spinner\b/, ['src/wallet/WalletModal.tsx', 'src/ui/WalletItemButton.tsx', 'src/ui/Feedback.tsx', 'src/ui/Spinner.tsx'])).toEqual([]);
});

test('no state words as loading text, no JS clock for the sweep', async () => {
  expect(await scan(/Measuring|useSweepPhase|useCellDeadline|--sk-phase|Loading\.\.\.|Loading…/, [])).toEqual([]);
});

test('Figure is light: no Tooltip, no focus stop, no role=img/alert per cell (the section owns the one alert)', async () => {
  const src = (await read('src/ui/Figure.tsx')).split('\n').filter((l) => !/^\s*(\/\*\*| \*|\/\/)/.test(l) && !/^import/.test(l)).join('\n');
  expect(src.match(/Tooltip|tabIndex|role="img"|role="alert"|useState|useEffect|useRef/g) ?? []).toEqual([]);
});

test('the value-state files never import Table or Feedback (they would drag 50 KB into an app entry)', async () => {
  for (const f of ['src/ui/Figure.tsx', 'src/ui/MetricState.tsx', 'src/ui/Dash.tsx', 'src/ui/Loaders.tsx', 'src/ui/Notice.tsx', 'src/ui/ImportFailureNotice.tsx', 'src/lib/cell.ts']) {
    expect((await read(f)).match(/from '\.\/(Table|Feedback|StateNotice)'/g) ?? []).toEqual([]);
  }
});
