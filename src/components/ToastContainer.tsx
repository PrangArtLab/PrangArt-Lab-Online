import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useStudio();

  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-2 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const icon =
          toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : toast.type === 'warning' ? (
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          );

        return (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.16)] dark:shadow-lg flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {icon}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {toast.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {toast.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Tutup notifikasi"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
