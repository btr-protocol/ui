// Type-level contract (checked by `tsc`, the runtime part only proves the file loads): a nameless icon button does not compile.
import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button } from '../src/ui/Button';
import { Icon } from '../src/ui/Icon';

test('icon-only needs an aria-label; collapse needs one too; a labelled button needs neither', () => {
  const ok = [
    <Button icon={<Icon name="copy" />} aria-label="Copy" />,
    <Button>Save</Button>,
    <Button icon={<Icon name="copy" />} collapse={1} aria-label="Copy">Copy</Button>,
  ];
  // @ts-expect-error no children and no aria-label: the button has no name
  const bad1 = <Button icon={<Icon name="copy" />} />;
  // @ts-expect-error collapse hides the label: the name must be stated
  const bad2 = <Button icon={<Icon name="copy" />} collapse={1}>Copy</Button>;
  expect([...ok, bad1, bad2].every((x) => render(x).includes('<button'))).toBe(true);
});
