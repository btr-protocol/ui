import { Toast } from '../ui/Feedback';
import { type Notification, removeNotification, useNotifications } from '../lib/notifications';
import { cn } from '../lib/cn';

const MAX_VISIBLE = 2;

export function Notifications() {
  const items = useNotifications();

  if (items.length === 0) return null;
  // Sticky toasts carry state the user must see (wallet waiting, wrong chain): never capped out.
  const sticky = items.filter((n) => n.duration === 0);
  const shown = [...sticky, ...items.filter((n) => n.duration !== 0).slice(0, MAX_VISIBLE)];

  return (
    // Sits one gutter above the footer (--chrome-b tracks its height + the nav-bar inset). Phones:
    // full width minus 8px, one line, tap dismisses, and BELOW modals (z-footer < z-modal) so a
    // toast never floats over an open sheet.
    <div className="no-print fixed inset-x-2 bottom-[calc(var(--chrome-b)+0.5rem)] z-footer sm:z-toast pointer-events-none">
      <div className="flex flex-col gap-2 mx-auto max-w-[var(--shell-w,72rem)] items-end">
        {shown.map((notification: Notification) => (
          // Tap target: the Toast itself is inert, so the click lands here.
          <div
            key={notification.id}
            onClick={notification.duration ? () => removeNotification(notification.id) : undefined}
            className={cn(
              'pointer-events-auto w-full sm:w-auto sm:max-w-sm',
              notification.duration && 'cursor-pointer',
              notification.duration === 0
                ? 'max-sm:[&_p]:line-clamp-3'
                : notification.link
                  ? 'max-sm:[&_p]:line-clamp-2'
                  : 'max-sm:[&_p]:truncate',
            )}
          >
            <Toast
              kind={notification.type}
              message={notification.message}
              link={notification.link}
              actions={notification.actions}
              duration={notification.duration}
              onDismiss={
                notification.locked ? undefined : () => removeNotification(notification.id)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
