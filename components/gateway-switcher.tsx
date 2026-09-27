"use client";

import Link from "next/link";
import { useSms } from "@/lib/context/sms-context";
import { Smartphone, ShieldCheck, AlertCircle, Settings } from "lucide-react";

export function GatewaySwitcher() {
  const { activeGatewayUsername, isGatewayOnline, gatewayConfig } = useSms();
  const isConnected = Boolean(activeGatewayUsername);

  return (
    <Link
      href="/connection"
      title={isConnected ? `Gateway: ${activeGatewayUsername} — click to manage` : "Set up your Android gateway"}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#21262d] hover:border-[#30363d] text-[#e6edf3] text-xs font-semibold transition group"
    >
      <div className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
        isGatewayOnline === true
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : isConnected
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-[#21262d] text-[#7d8590] border-[#30363d]"
      }`}>
        {isGatewayOnline === true
          ? <ShieldCheck className="h-3.5 w-3.5" />
          : isConnected
          ? <Smartphone className="h-3.5 w-3.5" />
          : <AlertCircle className="h-3.5 w-3.5" />}
      </div>
      <div className="text-left min-w-0">
        <div className="text-[10px] text-[#484f58] leading-none">
          {isConnected ? "Your Gateway" : "Gateway"}
        </div>
        <div className="text-xs font-bold text-white max-w-[120px] truncate leading-tight mt-0.5">
          {isConnected ? (gatewayConfig.name || activeGatewayUsername) : "Not Set Up"}
        </div>
      </div>
      <Settings className="h-3 w-3 text-[#484f58] group-hover:text-emerald-400 transition-colors shrink-0" />
    </Link>
  );
}
