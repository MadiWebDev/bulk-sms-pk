"use client";

import { useSms } from "@/lib/context/sms-context";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useSms();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[200] flex flex-col-reverse gap-2 max-w-[360px] w-full sm:right-6 pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isDanger  = toast.type === "danger";
        const isWarning = toast.type === "warning";

        const accent  = isDanger ? "#f85149" : isWarning ? "#e3b341" : isSuccess ? "#3fb950" : "#388bfd";
        const iconBg  = isDanger ? "bg-rose-500/10" : isWarning ? "bg-amber-500/10" : isSuccess ? "bg-emerald-500/10" : "bg-blue-500/10";
        const Icon    = isDanger ? AlertCircle : isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : Info;
        const timer   = isDanger ? "bg-rose-500" : isWarning ? "bg-amber-400" : isSuccess ? "bg-emerald-400" : "bg-blue-400";

        return (
          <div
            key={toast.id}
            className="pointer-events-auto relative overflow-hidden rounded-xl border bg-[#161b22] shadow-2xl shadow-black/60 animate-toast-in"
            style={{ borderColor: `${accent}40` }}
          >
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div className={`mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className="h-4 w-4" style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                {toast.title && (
                  <p className="text-sm font-semibold text-white leading-tight">{toast.title}</p>
                )}
                <p className="text-xs text-[#7d8590] mt-0.5 leading-relaxed break-words">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="absolute top-3 right-3 text-[#484f58] hover:text-white p-1 rounded transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Countdown bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#21262d]">
              <div
                className={`h-full ${timer}`}
                style={{ animation: `toastCountdown ${toast.durationMs}ms linear forwards` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
