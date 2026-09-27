import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { MessageStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: MessageStatus;
  stateText?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, stateText, size = "md" }: StatusBadgeProps) {
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  if (status === "delivered") return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${px}`}>
      <CheckCircle2 className="h-3 w-3" />{stateText || "Delivered"}
    </span>
  );
  if (status === "sending") return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 ${px}`}>
      <Loader2 className="h-3 w-3 animate-spin" />{stateText || "Sending"}
    </span>
  );
  if (status === "queued") return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${px}`}>
      <Clock className="h-3 w-3" />{stateText || "Queued"}
    </span>
  );
  if (status === "failed") return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${px}`}>
      <XCircle className="h-3 w-3" />{stateText || "Failed"}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold bg-[#161b22] text-[#7d8590] border border-[#21262d] ${px}`}>
      <Clock className="h-3 w-3" />{stateText || "Pending"}
    </span>
  );
}
