import { PakistanOperator } from "@/lib/pakistan-phone";

interface OperatorBadgeProps {
  operator?: PakistanOperator | string;
  size?: "sm" | "md";
}

export function OperatorBadge({ operator = "Unknown", size = "md" }: OperatorBadgeProps) {
  const op = operator as PakistanOperator;

  let bg = "bg-slate-800 text-slate-300 border-slate-700";
  let dot = "bg-slate-400";

  switch (op) {
    case "Jazz":
      bg = "bg-rose-950/60 text-rose-300 border-rose-500/30";
      dot = "bg-rose-500";
      break;
    case "Zong":
      bg = "bg-emerald-950/60 text-emerald-300 border-emerald-500/30";
      dot = "bg-emerald-500";
      break;
    case "Telenor":
      bg = "bg-sky-950/60 text-sky-300 border-sky-500/30";
      dot = "bg-sky-400";
      break;
    case "Ufone":
      bg = "bg-amber-950/60 text-amber-300 border-amber-500/30";
      dot = "bg-amber-500";
      break;
    case "SCOM":
      bg = "bg-indigo-950/60 text-indigo-300 border-indigo-500/30";
      dot = "bg-indigo-400";
      break;
    case "Onic":
      bg = "bg-purple-950/60 text-purple-300 border-purple-500/30";
      dot = "bg-purple-400";
      break;
  }

  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${bg} ${px}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{operator}</span>
    </span>
  );
}
