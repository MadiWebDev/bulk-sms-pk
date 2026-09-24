"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useSms } from "@/lib/context/sms-context";
import { OperatorBadge } from "@/components/operator-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Send,
  Zap,
  Users,
  FileText,
  History,
  Settings,
  Radio,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Smartphone,
  Database,
  ArrowUpRight,
  RefreshCw,
  Layers,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const {
    messages,
    campaigns,
    contacts,
    templates,
    isGatewayOnline,
    gatewayLatency,
    isCheckingGateway,
    testGatewayConnection,
    isMongoConnected,
    mongoStats,
    refreshMessages,
    gatewayConfig,
  } = useSms();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Computed summary metrics
  const totalSent = messages.length;
  const deliveredCount = messages.filter((m) => m.status === "delivered").length;
  const queuedCount = messages.filter((m) => m.status === "queued" || m.status === "sending").length;
  const failedCount = messages.filter((m) => m.status === "failed").length;

  const deliveryRate = totalSent > 0 ? Math.round(((deliveredCount + queuedCount) / totalSent) * 100) : 100;

  // Pakistani Operator breakdown from sent messages
  const operatorBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Jazz: 0,
      Zong: 0,
      Telenor: 0,
      Ufone: 0,
      SCOM: 0,
      Onic: 0,
    };

    messages.forEach((m) => {
      const op = m.operator || "Unknown";
      if (counts[op] !== undefined) {
        counts[op]++;
      }
    });

    return counts;
  }, [messages]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshMessages();
    await testGatewayConnection();
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Hero / Welcome Bar */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cellular Gateway Active &bull; Pakistan Standard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Enterprise SMS Command Center
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              High-throughput cellular SMS delivery across all Pakistani mobile networks (Jazz, Zong, Telenor, Ufone) powered by Android Gateway.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Refresh messages and connection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span>Sync</span>
            </button>

            <Link
              href="/test-sms"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition shadow-sm"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Test SMS</span>
            </Link>

            <Link
              href="/bulk-sms"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-400 transition shadow-lg shadow-emerald-600/20"
            >
              <Send className="h-3.5 w-3.5" />
              <span>New Bulk Campaign</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Executive Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Messages */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Dispatched</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-emerald-400 group-hover:scale-110 transition-transform">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalSent.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>All campaigns & test runs</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Card 2: Delivery Rate */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Gateway Acceptance</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{deliveryRate}%</div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2">
              <span>{deliveredCount + queuedCount} successful / enqueued</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-teal-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Card 3: Queued / In Transit */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active / Enqueued</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-amber-400 group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{queuedCount}</div>
            <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-2">
              <span>Cellular tower queue</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Card 4: Failed / Rejected */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Failed Dispatches</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-rose-400 group-hover:scale-110 transition-transform">
                <XCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{failedCount}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
              <span className={failedCount > 0 ? "text-rose-400" : "text-emerald-400"}>
                {failedCount > 0 ? "Inspect failure logs" : "0 rejection rate"}
              </span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
          </div>
        </div>

        {/* Status Banners: Gateway Health + MongoDB Connection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gateway Status Card */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${isGatewayOnline ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
                  <h3 className="text-sm font-bold text-white">Android Gateway Link</h3>
                </div>
                <button
                  type="button"
                  onClick={() => testGatewayConnection()}
                  disabled={isCheckingGateway}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  <Radio className={`h-3.5 w-3.5 ${isCheckingGateway ? "animate-pulse" : ""}`} />
                  {isCheckingGateway ? "Pinging..." : "Test Link"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Status</span>
                  <span className={`font-semibold ${isGatewayOnline ? "text-emerald-400" : "text-amber-400"}`}>
                    {isGatewayOnline ? "Connected" : isGatewayOnline === false ? "Unreachable" : "Ready"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Ping Latency</span>
                  <span className="font-semibold text-slate-200">
                    {gatewayLatency ? `${gatewayLatency} ms` : "--"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">SIM Slot</span>
                  <span className="font-semibold text-slate-200">SIM {gatewayConfig.simNumber || 1}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[11px] text-slate-500 block">Server Mode</span>
                  <span className="font-semibold text-slate-200 truncate" title={gatewayConfig.baseUrl}>
                    {gatewayConfig.baseUrl.includes("api.sms-gate.app") ? "Cloud Server" : "Local Wi-Fi"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Basic Auth Token configured &bull; E.164 clean phone formatting enforced
              </span>
              <Link href="/connection" className="text-emerald-400 hover:underline flex items-center gap-0.5">
                Configure <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className={`h-4 w-4 ${isMongoConnected ? "text-emerald-400" : "text-amber-400"}`} />
                  <h3 className="text-sm font-bold text-white">Database Storage</h3>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isMongoConnected
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {isMongoConnected ? "MongoDB Atlas" : "Local Storage"}
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isMongoConnected
                  ? `Connected to MongoDB database (${mongoStats?.messages || 0} messages, ${mongoStats?.campaigns || 0} campaigns, ${mongoStats?.contacts || 0} contacts recorded).`
                  : "All logs and campaigns are currently saved safely in your browser storage. Connect MongoDB in Connection Settings for permanent cloud persistence."}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {isMongoConnected ? "Multi-device Synced" : "Add MONGODB_URI in .env"}
              </span>
              <Link href="/connection" className="text-emerald-400 hover:underline flex items-center gap-0.5 font-medium">
                {isMongoConnected ? "Database Details" : "Connect MongoDB"} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Pakistan Operator Distribution & Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operator Distribution */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Pakistani Carrier Distribution</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automated 03xx prefix detection</p>
              </div>
              <span className="text-xs font-semibold text-emerald-400">
                {totalSent > 0 ? `${totalSent} Total` : "0 Dispatched"}
              </span>
            </div>

            <div className="space-y-3">
              {[
                { name: "Jazz / Mobilink", key: "Jazz", prefix: "0300-0309, 0320-0329", color: "bg-rose-500", border: "border-rose-500/30" },
                { name: "Zong (CMPak)", key: "Zong", prefix: "0310-0319", color: "bg-emerald-500", border: "border-emerald-500/30" },
                { name: "Telenor Pakistan", key: "Telenor", prefix: "0340-0349", color: "bg-sky-500", border: "border-sky-500/30" },
                { name: "Ufone (PTCL)", key: "Ufone", prefix: "0330-0337", color: "bg-amber-500", border: "border-amber-500/30" },
                { name: "SCOM / Onic", key: "SCOM", prefix: "0355, 0339", color: "bg-purple-500", border: "border-purple-500/30" },
              ].map((op) => {
                const count = operatorBreakdown[op.key] || 0;
                const pct = totalSent > 0 ? Math.round((count / totalSent) * 100) : 0;

                return (
                  <div key={op.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200">{op.name}</span>
                        <span className="text-[10px] text-slate-500">({op.prefix})</span>
                      </div>
                      <span className="font-bold text-slate-300">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${op.color} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                All Pakistani prefixes are normalized to international standard (+923XXXXXXXXX).
              </span>
            </div>
          </div>

          {/* Feature Navigation Cards (2 Columns) */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/test-sms"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md group hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                    <Zap className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mt-3 group-hover:text-amber-300 transition-colors">
                  Single & Test SMS Studio
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Validate Pakistani phone numbers, inspect carrier details, test live delivery, and preview on a realistic smartphone simulator.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-400">
                <span>Launch Test Studio</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/bulk-sms"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md group hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                    <Send className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mt-3 group-hover:text-emerald-300 transition-colors">
                  Bulk Campaign Dispatcher
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Send thousands of personalized SMS via direct paste, CSV data mapping, or contact groups with custom throttling delays.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span>Start Bulk Campaign</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/contacts"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md group hover:border-sky-500/40 hover:bg-slate-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mt-3 group-hover:text-sky-300 transition-colors">
                  Contacts & Phonebook
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Organize customers into groups (VIP, Leads, Lahore Clients), import CSVs, and send target campaigns in one click.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-400">
                <span>Manage {contacts.length} Contacts</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/templates"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md group hover:border-purple-500/40 hover:bg-slate-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mt-3 group-hover:text-purple-300 transition-colors">
                  SMS Templates Library
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Pakistani promotional sales, OTP verifications, courier tracking, and bilingual Urdu templates with variable tokens.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-purple-400">
                <span>View {templates.length} Templates</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>
        </div>

        {/* Recent SMS Activity Feed */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Message Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Live cellular dispatches and delivery reports</p>
            </div>
            <Link
              href="/history"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All Logs ({messages.length})</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {messages.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
              <Send className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No messages dispatched yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Ready to send your first message? Try the Single Test SMS Studio or launch a Bulk Campaign.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Link
                  href="/test-sms"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  Send First Test SMS
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-medium">Recipient</th>
                    <th className="pb-2.5 font-medium">Network</th>
                    <th className="pb-2.5 font-medium">Message Preview</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {messages.slice(0, 6).map((msg) => (
                    <tr key={msg.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 font-semibold text-white">
                        <div>{msg.nationalPhone || msg.phone}</div>
                        <div className="text-[10px] text-slate-500">{msg.phone}</div>
                      </td>
                      <td className="py-3">
                        <OperatorBadge operator={msg.operator} size="sm" />
                      </td>
                      <td className="py-3 max-w-xs truncate text-slate-300" title={msg.text}>
                        {msg.text}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={msg.status} stateText={msg.status} size="sm" />
                      </td>
                      <td className="py-3 text-right text-slate-400 text-[11px]">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}