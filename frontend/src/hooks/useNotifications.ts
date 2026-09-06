import { useCallback, useEffect, useRef, useState } from 'react';

export type NotificationTone = 'warning' | 'error' | 'info';

export interface Notification {
  id: string;
  tone: NotificationTone;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

let nextId = 0;

/** A stack of auto-dismissing (5s) notifications the caller can also close early. */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: NotificationTone, message: string) => {
      const id = `n${nextId++}`;
      setNotifications((list) => [...list, { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => timersAtMount.forEach((timer) => clearTimeout(timer));
  }, []);

  return { notifications, push, dismiss };
}
