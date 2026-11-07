import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';

interface PortalProps {
  children: ComponentChildren;
  className?: string;
  style?: import('preact').JSX.CSSProperties;
  containerId?: string;
  /** Ref on the portaled box - callers measure it to keep it inside the viewport. */
  innerRef?: import('preact').Ref<HTMLDivElement>;
}

/**
 * Body-level portal. Must use createPortal (not preact.render) so children keep
 * the React/Preact hook tree - FloatingPanel content with signals/hooks otherwise
 * throws "Hook can only be invoked from render methods".
 */
export function Portal({ children, className, style, containerId, innerRef }: PortalProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    if (containerId) el.id = containerId;
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.parentNode?.removeChild(el);
      setHost(null);
    };
  }, [containerId]);

  if (!host) return null;

  return createPortal(
    <div ref={innerRef} className={className} style={style}>
      {children}
    </div>,
    host,
  );
}
