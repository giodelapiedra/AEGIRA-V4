import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning';

const VARIANT_DURATIONS: Record<ToastVariant, number> = {
  success: 3000,
  default: 4000,
  warning: 5000,
  destructive: 6000,
};

const MAX_TOASTS = 5;
const EXIT_ANIMATION_MS = 300;

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** @internal Used by Toaster to trigger exit animation */
  _exiting?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCount = 0;

interface TimerState {
  timeout: ReturnType<typeof setTimeout>;
  startedAt: number;
  remaining: number;
}

function toastKey(t: { title?: string; description?: string }): string {
  return `${t.title ?? ''}::${t.description ?? ''}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, TimerState>>(new Map());
  const activeKeysRef = useRef<Set<string>>(new Set());

  const startExitAnimation = useCallback((id: string) => {
    setToasts((prev) => {
      const found = prev.find((t) => t.id === id);
      if (found) activeKeysRef.current.delete(toastKey(found));
      return prev.map((t) => (t.id === id ? { ...t, _exiting: true } : t));
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  const startDismissTimer = useCallback((id: string, duration: number) => {
    const timeout = setTimeout(() => {
      timersRef.current.delete(id);
      startExitAnimation(id);
    }, duration);

    timersRef.current.set(id, { timeout, startedAt: Date.now(), remaining: duration });
  }, [startExitAnimation]);

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeout);
      timersRef.current.delete(id);
    }
    startExitAnimation(id);
  }, [startExitAnimation]);

  const pauseToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeout);
      const elapsed = Date.now() - timer.startedAt;
      timer.remaining = Math.max(timer.remaining - elapsed, 0);
    }
  }, []);

  const resumeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer && timer.remaining > 0) {
      startDismissTimer(id, timer.remaining);
    }
  }, [startDismissTimer]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const key = toastKey(toast);

    // Duplicate prevention: skip if same title+description already showing
    if (activeKeysRef.current.has(key)) return;

    const id = String(++toastCount);
    const variant = toast.variant || 'default';
    const duration = VARIANT_DURATIONS[variant];

    activeKeysRef.current.add(key);

    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      // Cap at MAX_TOASTS — evict oldest
      while (next.length > MAX_TOASTS) {
        const removed = next.shift()!;
        activeKeysRef.current.delete(toastKey(removed));
        const timer = timersRef.current.get(removed.id);
        if (timer) {
          clearTimeout(timer.timeout);
          timersRef.current.delete(removed.id);
        }
      }
      return next;
    });

    startDismissTimer(id, duration);
  }, [startDismissTimer]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, pauseToast, resumeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return {
    toasts: context.toasts,
    toast: context.addToast,
    dismiss: context.removeToast,
    pauseToast: context.pauseToast,
    resumeToast: context.resumeToast,
  };
}

// Standalone toast function for use outside of React components
// This requires the ToastProvider to be mounted
let globalAddToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function setGlobalToast(addToast: (toast: Omit<Toast, 'id'>) => void) {
  globalAddToast = addToast;
}

export function toast(props: Omit<Toast, 'id'>) {
  if (globalAddToast) {
    globalAddToast(props);
  } else if (import.meta.env.DEV) {
    // Only log in development, not production
    console.warn('Toast called before ToastProvider mounted');
  }
}
