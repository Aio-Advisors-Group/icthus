import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * A single, polite live region. Announcements are read by screen readers
 * without stealing focus, which matters on a screen someone may be reading
 * slowly.
 */

type ToastContextValue = { notify: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={[
          'pointer-events-none fixed bottom-[104px] left-1/2 z-40 -translate-x-1/2',
          'rounded-full bg-[var(--ink)] px-4 py-2.5 text-[12px] text-[var(--paper)]',
          'transition-opacity duration-200',
          message ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {message ?? ''}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
