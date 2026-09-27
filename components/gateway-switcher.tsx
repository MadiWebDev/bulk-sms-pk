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
      title={isConnected ? `Your gateway: ${activeGatewayUsername} — click to manage` : "Set up your Android gateway"}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 text-xs font-semibold shadow-sm transition-all group"
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-colors ${
          isGatewayOnline === true
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : isConnected
            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
            : "bg-slate-800 text-slate-400 border-slate-700"
        }`}
      >
        {isGatewayOnline === true ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : isConnected ? (
          <Smartphone className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
      </div>

      <div className="text-left min-w-0">
        <div className="text-[10px] text-slate-400 leading-none">
          {isConnected ? "Your Gateway" : "Gateway"}
        </div>
        <div className="text-xs font-bold text-white max-w-[120px] truncate leading-tight mt-0.5">
          {isConnected ? (gatewayConfig.name || activeGatewayUsername) : "Not Set Up"}
        </div>
      </div>

      <Settings className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
    </Link>
  );
}
