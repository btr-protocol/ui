// Page for test/infobox-keys.browser.test.tsx: a modal that closes on Escape (`useDismiss`, as the real ones do)
// holding one InfoBox with a focusable body and one text-only InfoBox.
import { InfoBox } from '../../src/ui/InfoBox';
import { useDismiss } from '../../src/ui/useDismiss';
import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';

function App() {
  const [open, setOpen] = useState(true);
  const [clicks, setClicks] = useState(0);
  const modal = useRef<HTMLDivElement>(null);
  useDismiss(
    open,
    () => setOpen(false),
    (t) => !!modal.current?.contains(t),
  );
  return (
    <div>
      <output id="state">{open ? 'open' : 'closed'}</output>
      <output id="clicks">{clicks}</output>
      {open && (
        <div id="modal" ref={modal} style={{ display: 'flex', gap: 40, padding: 24 }}>
          <InfoBox
            label="Linked"
            content={
              <button type="button" id="inner" onClick={() => setClicks((c) => c + 1)}>
                copy
              </button>
            }
          />
          <InfoBox label="Plain" content="just words" />
        </div>
      )}
    </div>
  );
}

const root = document.createElement('div');
document.body.append(root);
render(<App />, root);
