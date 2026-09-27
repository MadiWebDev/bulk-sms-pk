"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useSms } from "@/lib/context/sms-context";
import { OperatorBadge } from "@/components/operator-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Send, Zap, Users, FileText, History, Settings, Radio,
  TrendingUp, CheckCircle2, Clock, XCircle, Smartphone,
  Database, ArrowUpRight, RefreshCw, ShieldCheck,
  Activity, BarChart3, ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const {
    messages, campaigns, contacts, templates,
    isGatewayOnline, gatewayLatency, isCheckingGateway,
    testGatewayConnection, isMongoConnected, mongoStats,
    refreshMessages, gatewayConfig, activeGatewayUsername,
  } = useSms();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalSent       = messages.length;
  const deliveredCount  = messages.filter(m => m.status === "delivered").length;
  const queuedCount     = messages.filter(m => m.status === "queued" || m.status === "sending").length;
  const failedCount     = messages.filter(m => m.status === "failed").length;
  const successRate     = totalSent > 0 ? Math.round(((deliveredCount + queuedCount) / totalSent) * 100) : 100;

  const operatorBreakdown = useMemo(() => {
    const c: Record<string, number> = { Jazz: 0, Zong: 0, Telenor: 0, Ufone: 0, SCOM: 0 };
    messages.forEach(m => { if (c[m.operator || ""] !== undefined) c[m.operator!]++; });
    return c;
  }, [messages]);

  const recentMessages = useMemo(() => messages.slice(0, 8), [messages]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshMessages(), testGatewayConnection()]);
    setIsRefreshing(false);
  };

  const OPERATORS = [
    { name: "Jazz", key: "Jazz", color: "#f85149" },
    { name: "Zong", key: "Zong", color: "#3fb950" },
    { name: "Telenor", key: "Telenor", color: "#388bfd" },
    { name: "Ufone", key: "Ufone", color: "#e3b341" },
    { name: "SCOM", key: "SCOM", color: "#a371f7" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#050810]">
      {/* Page header */}
      <div className="border-b border-[#21262d] bg-[#0d1117] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Dashboard
              </span>
              {activeGatewayUsername && (
                <span className="text-xs font-mono text-[#7d8590] bg-[#161b22] border border-[#21262d] rounded-full px-2.5 py-0.5">
                  {activeGatewayUsername}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">Command Center</h1>
            <p className="text-sm text-[#7d8590] mt-0.5">Enterprise SMS delivery across all Pakistani mobile networks</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleRefresh} disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#161b22] border border-[#21262d] text-[#7d8590] hover:text-white hover:border-[#30363d] transition disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              Sync
            </button>
            <Link href="/test-sms"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#161b22] border border-[#21262d] text-[#7d8590] hover:text-white hover:border-[#30363d] transition">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Test SMS
            </Link>
            <Link href="/bulk-sms"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-900/40">
              <Send className="h-3.5 w-3.5" /> New Campaign
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Dispatched", value: totalSent.toLocaleString(), icon: Send,         sub: "All campaigns & tests",               accent: "#3fb950" },
            { label: "Success Rate",     value: `${successRate}%`,          icon: TrendingUp,   sub: `${(deliveredCount+queuedCount).toLocaleString()} accepted`, accent: "#388bfd" },
            { label: "In Queue",         value: queuedCount.toLocaleString(),icon: Clock,        sub: "Pending delivery",                    accent: "#e3b341" },
            { label: "Failed",           value: failedCount.toLocaleString(),icon: XCircle,      sub: failedCount > 0 ? "Requires attention" : "No failures",   accent: failedCount > 0 ? "#f85149" : "#3fb950" },
          ].map(({ label, value, icon: Icon, sub, accent }) => (
            <div key={label} className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 hover:border-[#30363d] transition group">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-[#7d8590]">{label}</span>
                <div className="p-2 rounded-lg bg-[#161b22] transition-transform group-hover:scale-110">
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums">{value}</div>
              <p className="text-xs text-[#484f58] mt-1.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gateway health */}
          <div className="lg:col-span-2 rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${isGatewayOnline === true ? "bg-emerald-400" : isGatewayOnline === false ? "bg-rose-400" : "bg-[#484f58]"}`} />
                <h3 className="text-sm font-semibold text-white">Android Gateway</h3>
              </div>
              <button type="button" onClick={() => testGatewayConnection()} disabled={isCheckingGateway}
                className="text-xs text-[#7d8590] hover:text-white flex items-center gap-1 transition disabled:opacity-50">
                <Radio className={`h-3.5 w-3.5 ${isCheckingGateway ? "animate-pulse text-amber-400" : ""}`} />
                {isCheckingGateway ? "Testing…" : "Ping"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Status",      value: isGatewayOnline === true ? "Connected" : isGatewayOnline === false ? "Unreachable" : "Ready", color: isGatewayOnline === true ? "text-emerald-400" : isGatewayOnline === false ? "text-rose-400" : "text-[#7d8590]" },
                { label: "Latency",     value: gatewayLatency ? `${gatewayLatency} ms` : "—", color: "text-white" },
                { label: "SIM Slot",    value: `SIM ${gatewayConfig.simNumber || 1}`, color: "text-white" },
                { label: "Mode",        value: gatewayConfig.baseUrl?.includes("api.sms-gate.app") ? "Cloud" : "Local Wi-Fi", color: "text-white" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-[#161b22] border border-[#21262d] px-3 py-2.5">
                  <span className="text-[11px] text-[#484f58] block mb-0.5">{label}</span>
                  <span className={`text-sm font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#21262d] text-xs text-[#484f58]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Basic Auth • E.164 phone normalisation • Pakistan only
              </span>
              <Link href="/connection" className="flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 font-medium transition">
                Configure <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Database */}
          <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className={`h-4 w-4 ${isMongoConnected ? "text-emerald-400" : "text-[#484f58]"}`} />
                <h3 className="text-sm font-semibold text-white">Database</h3>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isMongoConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-[#161b22] text-[#7d8590] border-[#21262d]"
              }`}>
                {isMongoConnected ? "MongoDB Atlas" : "Browser Storage"}
              </span>
            </div>

            {isMongoConnected ? (
              <div className="grid grid-cols-2 gap-2 flex-1">
                {[
                  { label: "Messages",  value: mongoStats?.messages ?? messages.length },
                  { label: "Campaigns", value: mongoStats?.campaigns ?? campaigns.length },
                  { label: "Contacts",  value: mongoStats?.contacts ?? contacts.length },
                  { label: "Templates", value: mongoStats?.templates ?? templates.length },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-[#161b22] border border-[#21262d] px-3 py-2 text-center">
                    <div className="text-lg font-bold text-white tabular-nums">{value.toLocaleString()}</div>
                    <div className="text-[10px] text-[#484f58]">{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#7d8590] flex-1">
                All data is saved in your browser. Add <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">MONGODB_URI</code> in .env for cloud persistence.
              </p>
            )}

            <Link href="/connection" className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-medium transition">
              {isMongoConnected ? "Database details" : "Connect MongoDB"} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Carrier breakdown */}
          <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Carrier Distribution</h3>
              <span className="text-xs text-[#484f58]">{totalSent} total</span>
            </div>
            <div className="space-y-3">
              {OPERATORS.map(op => {
                const count = operatorBreakdown[op.key] || 0;
                const pct   = totalSent > 0 ? Math.round((count / totalSent) * 100) : 0;
                return (
                  <div key={op.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#7d8590]">{op.name}</span>
                      <span className="text-white font-semibold tabular-nums">{count} <span className="text-[#484f58] font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#161b22] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: op.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick nav tiles */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { href: "/test-sms",  icon: Zap,      label: "Test SMS",       sub: "Single message",   accent: "#e3b341", bg: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 hover:border-amber-500/30" },
              { href: "/bulk-sms",  icon: Send,     label: "Bulk Campaign",  sub: `${campaigns.length} campaigns`,   accent: "#3fb950", bg: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/30" },
              { href: "/contacts",  icon: Users,    label: "Contacts",       sub: `${contacts.length} saved`,        accent: "#388bfd", bg: "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 hover:border-blue-500/30" },
              { href: "/templates", icon: FileText, label: "Templates",      sub: `${templates.length} available`,   accent: "#a371f7", bg: "bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/20 hover:border-purple-500/30" },
              { href: "/history",   icon: History,  label: "Delivery Logs",  sub: `${messages.length} records`,      accent: "#3fb950", bg: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/30" },
              { href: "/connection",icon: Settings, label: "Connection",     sub: "Gateway & DB",     accent: "#7d8590", bg: "bg-[#161b22] hover:bg-[#1c2129] border-[#21262d] hover:border-[#30363d]" },
            ].map(({ href, icon: Icon, label, sub, accent, bg }) => (
              <Link key={href} href={href}
                className={`flex flex-col justify-between p-4 rounded-xl border transition group ${bg}`}>
                <Icon className="h-5 w-5 mb-3" style={{ color: accent }} />
                <div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-[#484f58] mt-0.5">{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent messages */}
        {recentMessages.length > 0 && (
          <div className="rounded-xl bg-[#0d1117] border border-[#21262d] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#484f58]" /> Recent Activity
              </h3>
              <Link href="/history" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#21262d] text-[#484f58]">
                    <th className="px-5 py-3 text-left font-medium">Recipient</th>
                    <th className="px-5 py-3 text-left font-medium">Network</th>
                    <th className="px-5 py-3 text-left font-medium">Message</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]">
                  {recentMessages.map(msg => (
                    <tr key={msg.id} className="hover:bg-[#161b22] transition">
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{msg.nationalPhone || msg.phone}</div>
                        <div className="text-[10px] text-[#484f58] font-mono">{msg.phone}</div>
                      </td>
                      <td className="px-5 py-3"><OperatorBadge operator={msg.operator} size="sm" /></td>
                      <td className="px-5 py-3 max-w-[200px]">
                        <span className="text-[#7d8590] truncate block">{msg.text}</span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={msg.status} size="sm" /></td>
                      <td className="px-5 py-3 text-[#484f58] whitespace-nowrap">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty dashboard hint */}
        {totalSent === 0 && (
          <div className="rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] p-12 text-center">
            <Send className="h-10 w-10 text-[#30363d] mx-auto mb-4" />
            <h3 className="text-base font-semibold text-white mb-1">Ready to send your first campaign</h3>
            <p className="text-sm text-[#7d8590] mb-6 max-w-sm mx-auto">
              Configure your Android gateway, then send a test message or launch a bulk campaign.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/connection" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#161b22] border border-[#21262d] text-[#7d8590] hover:text-white transition">
                <Settings className="h-4 w-4" /> Configure Gateway
              </Link>
              <Link href="/test-sms" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-900/40">
                <Zap className="h-4 w-4" /> Send Test SMS
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
