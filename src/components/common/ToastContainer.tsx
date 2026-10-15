import React from 'react';
import { useRealtime } from '../../context/RealtimeContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useRealtime();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-inverse-surface/95 text-inverse-on-surface backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-inverse-surface flex items-start gap-3 animate-in slide-in-from-top duration-200"
        >
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[16px]">notifications</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="font-label-md text-xs font-bold leading-tight">{toast.title}</span>
              <span className="font-mono text-[10px] text-inverse-on-surface/60">{toast.timestamp}</span>
            </div>
            <p className="font-body-sm text-xs text-inverse-on-surface/90 mt-0.5 leading-snug">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-inverse-on-surface/60 hover:text-inverse-on-surface p-0.5"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
