"use client";

import { useState } from "react";
import Link from "next/link";
import { useSms } from "@/lib/context/sms-context";
import { Smartphone, Check, Plus, Settings, ShieldCheck, AlertCircle } from "lucide-react";

export function GatewaySwitcher() {
  const {
    activeGatewayUsername,
    savedGateways,
    setActiveGatewayUsername,
    isGatewayOnline,
    showToast,
  } = useSms();
  const [isOpen, setIsOpen] = useState(false);

  const activeGw = savedGateways.find((g) => g.username === activeGatewayUsername) || {
    username: activeGatewayUsername || "No Gateway",
    name: activeGatewayUsername ? `Android (${activeGatewayUsername})` : "Configure Gateway",
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 text-xs font-semibold shadow-sm transition-all"
        title="Switch Android Gateway Credential Account"
      >
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-lg border ${
            isGatewayOnline
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </div>
        <div className="text-left">
          <div className="text-[10px] text-slate-400 leading-none">Android Gateway</div>
          <div className="text-xs font-bold text-white max-w-[130px] truncate leading-tight mt-0.5">
            {activeGatewayUsername ? activeGw.username : "Not Connected"}
          </div>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 text-xs space-y-1">
            <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Android Credentials</span>
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            </div>

            <p className="px-3 py-1 text-[11px] text-slate-400">
              Each credential has its own isolated contact list and delivery history.
            </p>

            <div className="max-h-56 overflow-y-auto space-y-1 py-1">
              {savedGateways.length === 0 ? (
                <div className="px-3 py-3 text-center text-slate-500 text-xs">
                  No verified gateway credentials saved in database yet.
                </div>
              ) : (
                savedGateways.map((g) => {
                  const isSelected = g.username === activeGatewayUsername;
                  return (
                    <button
                      key={g.username}
                      type="button"
                      onClick={() => {
                        setActiveGatewayUsername(g.username);
                        setIsOpen(false);
                        showToast(
                          "info",
                          `Switched to credential "${g.username}". Contacts & history updated.`,
                          "Gateway Switched"
                        );
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold truncate">{g.name || g.username}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          User: {g.username} &bull; SIM {g.simNumber || 1}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {g.isVerified && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                            Verified
                          </span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-1 border-t border-slate-800">
              <Link
                href="/connection"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 font-semibold border border-slate-800 transition text-center"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add / Configure Credentials</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
