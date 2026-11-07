import { haptic } from '../lib/haptic';
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { Button, type ButtonProps } from './Button';

/** How long a keyboard / TalkBack "arm" stays live before it lapses. */
export const ARM_MS = 4000;

type HoldPhase = 'idle' | 'holding' | 'armed' | 'done';
export interface HoldState {
  phase: HoldPhase;
  t0: number;
}
export type HoldEvent =
  | { type: 'down' | 'tick' | 'up' | 'cancel' | 'expire'; now: number }
  /** `pointer`: a pointerdown preceded this click. A touch/mouse press that was too short is not
   *  a confirmation; a click WITHOUT one (Enter/Space, TalkBack's double-tap) is an assistive
   *  user who cannot hold, so it arms a second activation instead. */
  | { type: 'click'; now: number; pointer: boolean };

/** The whole gesture as a reducer, so the timing rules are testable without a DOM. `disabled` is
 *  re-checked at completion: a revert or chain mismatch appearing mid-hold must not confirm. */
export function holdReduce(s: HoldState, e: HoldEvent, ms: number, disabled = false): HoldState {
  const next = step(s, e, ms);
  return disabled && next.phase === 'done' ? { phase: 'idle', t0: 0 } : next;
}

function step(s: HoldState, e: HoldEvent, ms: number): HoldState {
  switch (e.type) {
    case 'down':
      return s.phase === 'done' ? s : { phase: 'holding', t0: e.now };
    case 'tick':
      return s.phase === 'holding' && e.now - s.t0 >= ms ? { phase: 'done', t0: s.t0 } : s;
    case 'up':
    case 'cancel':
      return s.phase === 'holding' ||
        s.phase === 'done' ||
        (e.type === 'cancel' && s.phase === 'armed')
        ? { phase: 'idle', t0: 0 }
        : s;
    case 'expire':
      return s.phase === 'armed' && e.now - s.t0 >= ARM_MS ? { phase: 'idle', t0: 0 } : s;
    case 'click':
      if (e.pointer) return s;
      return s.phase === 'armed' ? { phase: 'done', t0: s.t0 } : { phase: 'armed', t0: e.now };
  }
}

interface HoldButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Hold time in ms; 0 = an ordinary tap. */
  hold: number;
  onConfirm: () => void;
  children: ComponentChildren;
}

/** Friction where a mistake costs something: the fill is the countdown, releasing early does
 *  nothing, and a keyboard / TalkBack user confirms with two activations instead. */
export function HoldButton({ hold, onConfirm, children, className, ...rest }: HoldButtonProps) {
  const [s, dispatch] = useReducer(
    (st: HoldState, e: HoldEvent) => holdReduce(st, e, hold, rest.disabled),
    {
      phase: 'idle',
      t0: 0,
    },
  );
  const [hint, setHint] = useState(false);
  const pointer = useRef(false);
  const swallow = useRef(false);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;

  useEffect(() => {
    if (s.phase === 'holding') {
      haptic('tap');
      const cancel = () => dispatch({ type: 'cancel', now: Date.now() });
      const t = setTimeout(
        () => dispatch({ type: 'tick', now: Date.now() }),
        Math.max(0, hold - (Date.now() - s.t0)),
      );
      // A scroll gesture is not a confirmation.
      window.addEventListener('scroll', cancel, { capture: true, passive: true });
      return () => {
        clearTimeout(t);
        window.removeEventListener('scroll', cancel, { capture: true });
      };
    }
    if (s.phase === 'armed') {
      const t = setTimeout(() => dispatch({ type: 'expire', now: Date.now() }), ARM_MS);
      return () => clearTimeout(t);
    }
    if (s.phase === 'done') {
      haptic('medium');
      swallow.current = pointer.current;
      dispatch({ type: 'up', now: Date.now() });
      confirm.current();
    }
  }, [s, hold]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 1500);
    return () => clearTimeout(t);
  }, [hint]);

  if (hold <= 0) {
    return (
      <Button
        {...rest}
        className={className}
        onClick={() => {
          haptic('medium');
          onConfirm();
        }}
      >
        {children}
      </Button>
    );
  }

  const holding = s.phase === 'holding';
  const now = () => Date.now();
  return (
    <Button
      {...rest}
      className={cn(
        'relative overflow-hidden select-none [-webkit-touch-callout:none] [touch-action:manipulation]',
        className,
      )}
      onContextMenu={(e: Event) => e.preventDefault()}
      onPointerDown={() => {
        pointer.current = true;
        dispatch({ type: 'down', now: now() });
      }}
      onPointerUp={() => dispatch({ type: 'up', now: now() })}
      onPointerCancel={() => dispatch({ type: 'cancel', now: now() })}
      onPointerLeave={() => dispatch({ type: 'cancel', now: now() })}
      onClick={() => {
        const swallowed = swallow.current;
        swallow.current = false;
        const was = pointer.current;
        pointer.current = false;
        if (swallowed) return;
        dispatch({ type: 'click', now: now(), pointer: was });
        if (was) setHint(true);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 origin-left bg-current opacity-25"
        style={{
          transform: `scaleX(${holding ? 1 : 0})`,
          transition: holding ? `transform ${hold}ms linear` : 'transform 150ms ease-out',
        }}
      />
      <span className="relative">
        {s.phase === 'armed' ? 'Tap again to confirm' : hint ? 'Hold to confirm' : children}
      </span>
      <span className="sr-only">Press and hold to confirm, or activate twice.</span>
    </Button>
  );
}
