import { cn } from '../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin w-4 h-4 border rounded-full border-primary border-t-transparent',
        className,
      )}
    />
  );
}
