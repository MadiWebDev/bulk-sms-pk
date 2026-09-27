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
} from "lucide-react";

import { GatewaySwitcher } from "@/components/gateway-switcher";

export function Navigation() {
  const pathname = usePathname();
  const {
    isGatewayOnline,
    gatewayLatency,
    isCheckingGateway,
    testGatewayConnection,
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

  const statusColor =
    isCheckingGateway
      ? "text-amber-400"
      : isGatewayOnline === true
      ? "text-emerald-400"
      : isGatewayOnline === false
      ? "text-rose-400"
      : "text-slate-400";

  const statusBg =
    isGatewayOnline === true
      ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40"
      : isGatewayOnline === false
      ? "bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-900/40"
      : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800";

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4 lg:px-6">
          {/* Brand */}
          <Link
            href="/"
            className="group flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9">
              <Smartphone className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-extrabold tracking-tight text-white transition-colors group-hover:text-emerald-300 sm:text-base">
                  SMS Gateway
                </span>
                <span className="hidden shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 xs:inline-flex">
                  PK 🇵🇰
                </span>
                <span className="hidden shrink-0 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-400 md:inline-flex">
                  PRO
                </span>
              </div>
              <p className="hidden truncate text-[11px] text-slate-400 sm:block">
                Enterprise Cellular SMS Hub • 03xx / +923xx
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links (xl and up) */}
          <nav className="hidden items-center gap-1 rounded-xl border border-slate-800/60 bg-slate-900/60 p-1 xl:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isActive ? "text-emerald-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status Actions */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Gateway Switcher (hidden on very small screens, shown inside mobile menu) */}
            <div className="hidden sm:block">
              <GatewaySwitcher />
            </div>

            {/* Gateway Status & Quick Ping (md and up) */}
            <button
              type="button"
              onClick={() => testGatewayConnection()}
              disabled={isCheckingGateway}
              className={`hidden items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all md:flex ${statusBg}`}
              title="Click to ping SMS Gateway"
            >
              <Radio
                className={`h-3.5 w-3.5 shrink-0 ${
                  isCheckingGateway ? "animate-pulse" : ""
                } ${statusColor}`}
              />
              <span>{gatewayLabel}</span>
            </button>

            {/* Mobile: compact ping icon (below md) */}
            <button
              type="button"
              onClick={() => testGatewayConnection()}
              disabled={isCheckingGateway}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors md:hidden ${statusBg}`}
              title="Ping Gateway"
              aria-label="Ping Gateway"
            >
              <Radio
                className={`h-4 w-4 ${
                  isCheckingGateway ? "animate-pulse" : ""
                } ${statusColor}`}
              />
            </button>

            {/* Mobile menu toggle (below xl) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:text-white xl:hidden"
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
            className="fixed inset-0 top-14 z-40 bg-slate-950/60 backdrop-blur-sm sm:top-16 xl:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Panel */}
          <div className="fixed inset-x-0 top-14 z-40 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-slate-800/80 bg-slate-950/98 sm:top-16 sm:max-h-[calc(100vh-4rem)] xl:hidden">
            <div className="px-3 py-3 sm:px-4 sm:py-4">
              {/* Gateway Switcher (mobile only, since it's hidden in header below sm) */}
              <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Gateway
                </span>
                <GatewaySwitcher />
              </div>

              {/* Nav Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                          : "border border-transparent bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Status Row */}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-800/80 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="font-semibold uppercase tracking-wider">
                    Status
                  </span>
                </div>
                <button
                  onClick={() => {
                    testGatewayConnection();
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 self-start transition-colors sm:self-auto ${statusColor} hover:opacity-80`}
                >
                  <Radio
                    className={`h-3.5 w-3.5 ${
                      isCheckingGateway ? "animate-pulse" : ""
                    }`}
                  />
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