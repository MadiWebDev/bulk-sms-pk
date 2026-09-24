import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { MessageStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: MessageStatus;
  stateText?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, stateText, size = "md" }: StatusBadgeProps) {
  const isDelivered = status === "delivered";
  const isQueued = status === "queued";
  const isSending = status === "sending";
  const isFailed = status === "failed";

  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  if (isDelivered) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 font-semibold ${sizeClass}`}>
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        <span>{stateText || "Delivered"}</span>
      </span>
    );
  }

  if (isSending) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-sky-950/50 text-sky-300 border border-sky-500/30 font-semibold ${sizeClass}`}>
        <Loader2 className="h-3 w-3 text-sky-400 animate-spin" />
        <span>{stateText || "Sending..."}</span>
      </span>
    );
  }

  if (isQueued) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-amber-950/50 text-amber-300 border border-amber-500/30 font-semibold ${sizeClass}`}>
        <Clock className="h-3 w-3 text-amber-400" />
        <span>{stateText || "Enqueued"}</span>
      </span>
    );
  }

  if (isFailed) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-rose-950/50 text-rose-300 border border-rose-500/30 font-semibold ${sizeClass}`}>
        <XCircle className="h-3 w-3 text-rose-400" />
        <span>{stateText || "Failed"}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold ${sizeClass}`}>
      <Clock className="h-3 w-3 text-slate-400" />
      <span>{stateText || "Pending"}</span>
    </span>
  );
}
