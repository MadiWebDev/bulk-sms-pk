"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSms } from "@/lib/context/sms-context";
import {
  LayoutDashboard,
  Send,
  Users,
  FileText,
  History,
  Settings,
  Radio,
  Menu,
  X,
  Zap,
  Smartphone,
  ChevronRight,
  Activity,
  Wifi,
  WifiOff,
} from "lucide-react";
import { GatewaySwitcher } from "@/components/gateway-switcher";

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/",           icon: LayoutDashboard, group: "main" },
  { label: "Test SMS",        href: "/test-sms",   icon: Zap,             group: "main" },
  { label: "Bulk Campaign",   href: "/bulk-sms",   icon: Send,            group: "main" },
  { label: "Delivery Logs",   href: "/history",    icon: History,         group: "data" },
  { label: "Contacts",        href: "/contacts",   icon: Users,           group: "data" },
  { label: "Templates",       href: "/templates",  icon: FileText,        group: "data" },
  { label: "Connection",      href: "/connection", icon: Settings,        group: "system" },
];

export function Navigation() {
  const pathname = usePathname();
  const { isGatewayOnline, gatewayLatency, isCheckingGateway, testGatewayConnection, activeGatewayUsername, gatewayConfig } = useSms();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const statusDot =
    isCheckingGateway ? "bg-amber-400 animate-pulse" :
    isGatewayOnline === true ? "bg-emerald-400" :
    isGatewayOnline === false ? "bg-rose-400" : "bg-slate-600";

  const statusText =
    isCheckingGateway ? "Pinging…" :
    isGatewayOnline === true ? `Online · ${gatewayLatency}ms` :
    isGatewayOnline === false ? "Offline" : "Not tested";

  const groups = [
    { id: "main",   label: "Dispatch",   items: NAV_ITEMS.filter(n => n.group === "main") },
    { id: "data",   label: "Data",       items: NAV_ITEMS.filter(n => n.group === "data") },
    { id: "system", label: "System",     items: NAV_ITEMS.filter(n => n.group === "system") },
  ];

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#21262d]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/40">
          <Smartphone className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-tight truncate">SMS Gateway</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-px">PK 🇵🇰</span>
            <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-px">PRO</span>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto text-[#7d8590] hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {groups.map(({ id, label, items }) => (
          <div key={id}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-[#484f58]">{label}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                      active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-[#7d8590] hover:text-white hover:bg-[#161b22]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-400" : "text-[#484f58] group-hover:text-[#7d8590]"}`} />
                    <span className="truncate">{item.label}</span>
                    {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-emerald-500/60" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: gateway status + switcher */}
      <div className="border-t border-[#21262d] px-3 py-3 space-y-2">
        {/* Gateway status row */}
        <button
          type="button"
          onClick={() => testGatewayConnection()}
          disabled={isCheckingGateway}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22] border border-[#21262d] hover:border-[#30363d] transition text-xs group"
          title="Click to test gateway"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[10px] text-[#7d8590]">Gateway</div>
            <div className={`text-xs font-semibold truncate ${isGatewayOnline === true ? "text-emerald-400" : isGatewayOnline === false ? "text-rose-400" : "text-[#7d8590]"}`}>
              {statusText}
            </div>
          </div>
          <Radio className={`h-3.5 w-3.5 shrink-0 text-[#484f58] group-hover:text-[#7d8590] ${isCheckingGateway ? "animate-pulse" : ""}`} />
        </button>

        {/* Active gateway account */}
        <Link href="/connection" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#161b22] transition group">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#161b22] border border-[#21262d] text-[#7d8590]">
            <Smartphone className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[#484f58]">Active Gateway</div>
            <div className="text-xs font-semibold text-white truncate max-w-[120px]">
              {activeGatewayUsername || gatewayConfig.name || "Not configured"}
            </div>
          </div>
          <Settings className="h-3 w-3 text-[#484f58] group-hover:text-[#7d8590] shrink-0" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col w-[220px] bg-[#0d1117] border-r border-[#21262d]">
        <SidebarContent />
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-[#0d1117]/95 backdrop-blur-xl border-b border-[#21262d]">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <Smartphone className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm text-white">SMS Gateway</span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-px">PK</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Inline status dot */}
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#21262d] bg-[#161b22] text-[#7d8590] hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile slide-in drawer ────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0d1117] border-r border-[#21262d] lg:hidden animate-slide-down">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
