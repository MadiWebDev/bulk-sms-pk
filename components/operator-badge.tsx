import { PakistanOperator } from "@/lib/pakistan-phone";

interface OperatorBadgeProps {
  operator?: PakistanOperator | string;
  size?: "sm" | "md";
}

const CONFIG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Jazz:    { dot: "#f85149", text: "#ff7b72", bg: "bg-rose-500/10",   border: "border-rose-500/20" },
  Zong:    { dot: "#3fb950", text: "#7ee787", bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
  Telenor: { dot: "#388bfd", text: "#79c0ff", bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  Ufone:   { dot: "#e3b341", text: "#f0c040", bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  SCOM:    { dot: "#a371f7", text: "#c9a7f7", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  Onic:    { dot: "#a371f7", text: "#c9a7f7", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};

export function OperatorBadge({ operator = "Unknown", size = "md" }: OperatorBadgeProps) {
  const cfg = CONFIG[operator as string] ?? { dot: "#484f58", text: "#7d8590", bg: "bg-[#161b22]", border: "border-[#21262d]" };
  const px  = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${cfg.bg} ${cfg.border} ${px}`} style={{ color: cfg.text }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {operator}
    </span>
  );
}
