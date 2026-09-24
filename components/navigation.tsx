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
  Database,
  Menu,
  X,
  Zap,
  Smartphone,
  ChevronDown,
} from "lucide-react";

import { GatewaySwitcher } from "@/components/gateway-switcher";

export function Navigation() {
  const pathname = usePathname();
  const {
    isGatewayOnline,
    gatewayLatency,
    isCheckingGateway,
    testGatewayConnection,
    isMongoConnected,
  } = useSms();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Test & Single SMS", href: "/test-sms", icon: Zap },
    { label: "Bulk Campaign", href: "/bulk-sms", icon: Send },
    { label: "Delivery Logs", href: "/history", icon: History },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Templates", href: "/templates", icon: FileText },
    { label: "Connection", href: "/connection", icon: Settings },
  ];

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const gatewayLabel = isCheckingGateway
    ? "Pinging..."
    : isGatewayOnline === true
    ? `Online (${gatewayLatency}ms)`
    : isGatewayOnline === false
    ? "Offline"
    : "Ping Gateway";

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
          {/* Brand */}
          <Link href="/" className="flex min-w-0 items-center gap-2 group shrink">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200 sm:h-10 sm:w-10">
              <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-extrabold tracking-tight text-white group-hover:text-emerald-300 transition-colors sm:text-base whitespace-nowrap">
                  SMS Gateway
                </span>
                <span className="hidden xs:inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  PK 🇵🇰
                </span>
                <span className="hidden md:inline-flex rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                  PRO
                </span>
              </div>
              <p className="hidden text-[11px] text-slate-400 sm:block truncate">
                Enterprise Cellular SMS Hub • 03xx / +923xx
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links (lg and up) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      isActive ? "text-emerald-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <GatewaySwitcher />

            {/* Gateway Status & Quick Ping */}
            <button
              type="button"
              onClick={() => testGatewayConnection()}
              disabled={isCheckingGateway}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                isGatewayOnline === true
                  ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40"
                  : isGatewayOnline === false
                  ? "bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-900/40"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
              }`}
              title="Click to ping SMS Gateway"
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  isCheckingGateway
                    ? "animate-pulse text-amber-400"
                    : isGatewayOnline === true
                    ? "text-emerald-400"
                    : isGatewayOnline === false
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              />
              <span>{gatewayLabel}</span>
            </button>
          </div>

          {/* Mobile/Tablet menu button (below lg) */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
         

            <button
              type="button"
              onClick={() => testGatewayConnection()}
              disabled={isCheckingGateway}
              className={`md:hidden flex h-8 w-8 items-center justify-center rounded-lg border ${
                isGatewayOnline === true
                  ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40"
                  : isGatewayOnline === false
                  ? "bg-rose-950/40 text-rose-300 border-rose-500/40"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
              title="Ping Gateway"
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  isCheckingGateway
                    ? "animate-pulse text-amber-400"
                    : isGatewayOnline === true
                    ? "text-emerald-400"
                    : isGatewayOnline === false
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-[57px] z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Panel */}
          <div className="fixed inset-x-0 top-[57px] z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-t border-slate-800/80 bg-slate-950/98 lg:hidden">
            <div className="px-3 py-3 sm:px-4 sm:py-4">
              {/* Nav Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Status Row */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
               
                <button
                  onClick={() => {
                    testGatewayConnection();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors self-start sm:self-auto"
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>
                    {isCheckingGateway
                      ? "Pinging Gateway..."
                      : isGatewayOnline === true
                      ? `Gateway Online (${gatewayLatency}ms)`
                      : isGatewayOnline === false
                      ? "Gateway Offline"
                      : "Test Gateway"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}