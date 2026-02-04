import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCount = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(++toastCount);

    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
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
