import { useEffect } from 'react';
import { useToast, setGlobalToast } from '@/lib/hooks/use-toast';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export function Toaster() {
  const { toasts, toast, dismiss, pauseToast, resumeToast } = useToast();

  // Register global toast function
  useEffect(() => {
    setGlobalToast(toast);
  }, [toast]);

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          onMouseEnter={() => pauseToast(t.id)}
          onMouseLeave={() => resumeToast(t.id)}
          className={`
            pointer-events-auto
            relative flex items-start gap-3 p-4 pr-10 rounded-lg shadow-lg border bg-white
            transition-all duration-300 ease-out
            ${t._exiting
              ? 'animate-out fade-out slide-out-to-right-full duration-300'
              : 'animate-in slide-in-from-top-2 fade-in duration-300'
            }
            ${t.variant === 'destructive' ? 'border-red-200 bg-red-50' : ''}
            ${t.variant === 'success' ? 'border-green-200 bg-green-50' : ''}
            ${t.variant === 'warning' ? 'border-amber-200 bg-amber-50' : ''}
            ${!t.variant || t.variant === 'default' ? 'border-gray-200' : ''}
          `}
        >
          {/* Icon */}
          <div className="flex-shrink-0">
            {t.variant === 'destructive' && (
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            )}
            {t.variant === 'success' && (
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            )}
            {t.variant === 'warning' && (
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            )}
            {(!t.variant || t.variant === 'default') && (
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-1">
            {t.title && (
              <p className={`text-sm font-semibold ${
                t.variant === 'destructive' ? 'text-red-800' :
                t.variant === 'success' ? 'text-green-800' :
                t.variant === 'warning' ? 'text-amber-800' :
                'text-gray-900'
              }`}>
                {t.title}
              </p>
            )}
            {t.description && (
              <p className={`text-sm mt-0.5 ${
                t.variant === 'destructive' ? 'text-red-700' :
                t.variant === 'success' ? 'text-green-700' :
                t.variant === 'warning' ? 'text-amber-700' :
                'text-gray-600'
              }`}>
                {t.description}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className={`
              absolute top-3 right-3 p-1.5 rounded-full transition-colors
              ${t.variant === 'destructive' ? 'text-red-400 hover:text-red-600 hover:bg-red-100' : ''}
              ${t.variant === 'success' ? 'text-green-400 hover:text-green-600 hover:bg-green-100' : ''}
              ${t.variant === 'warning' ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-100' : ''}
              ${!t.variant || t.variant === 'default' ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : ''}
            `}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
