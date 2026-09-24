"use client";

import { useSms } from "@/lib/context/sms-context";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useSms();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <style>{`
        @keyframes toastCountdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isDanger = toast.type === "danger";
        const isWarning = toast.type === "warning";

        const borderClass = isSuccess
          ? "border-emerald-500/40 bg-slate-900/95"
          : isDanger
          ? "border-rose-500/40 bg-slate-900/95"
          : isWarning
          ? "border-amber-500/40 bg-slate-900/95"
          : "border-sky-500/40 bg-slate-900/95";

        const timerClass = isSuccess
          ? "bg-emerald-400"
          : isDanger
          ? "bg-rose-400"
          : isWarning
          ? "bg-amber-400"
          : "bg-sky-400";

        const Icon = isSuccess
          ? CheckCircle2
          : isDanger
          ? AlertCircle
          : isWarning
          ? AlertTriangle
          : Info;

        const iconColor = isSuccess
          ? "text-emerald-400"
          : isDanger
          ? "text-rose-400"
          : isWarning
          ? "text-amber-400"
          : "text-sky-400";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative overflow-hidden rounded-xl border p-3.5 shadow-2xl shadow-black/60 backdrop-blur-md transition-all duration-300 ${borderClass}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                {toast.title && (
                  <h4 className="text-xs font-bold text-white tracking-wide">{toast.title}</h4>
                )}
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Countdown timer bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
              <div
                className={`h-full ${timerClass}`}
                style={{
                  animation: `toastCountdown ${toast.durationMs}ms linear forwards`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
