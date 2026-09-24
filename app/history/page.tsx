"use client";

import { useState, useMemo } from "react";
import { useSms } from "@/lib/context/sms-context";
import { OperatorBadge } from "@/components/operator-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  Database,
  ExternalLink,
  ChevronRight,
  Send,
  AlertCircle,
} from "lucide-react";

export default function HistoryPage() {
  const {
    messages,
    clearMessages,
    refreshMessages,
    updateMessageStatus,
    isMongoConnected,
    gatewayConfig,
    showToast,
    activeGatewayUsername,
    savedGateways,
  } = useSms();

  const activeGw = savedGateways.find((g) => g.username === activeGatewayUsername) || {
    username: activeGatewayUsername || "Default",
    name: activeGatewayUsername ? `Android (${activeGatewayUsername})` : "Default",
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (operatorFilter !== "all" && m.operator !== operatorFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPhone = m.phone?.toLowerCase().includes(q);
        const matchesNat = m.nationalPhone?.toLowerCase().includes(q);
        const matchesText = m.text?.toLowerCase().includes(q);
        const matchesId = m.gatewayId?.toLowerCase().includes(q);
        if (!matchesPhone && !matchesNat && !matchesText && !matchesId) return false;
      }
      return true;
    });
  }, [messages, statusFilter, operatorFilter, searchQuery]);

  // Sync statuses with sms-gate.app for queued messages
  const handleSyncGatewayStatuses = async () => {
    const queuedIds = messages
      .filter((m) => (m.status === "queued" || m.status === "sending") && m.gatewayId)
      .map((m) => m.gatewayId as string)
      .slice(0, 30);

    if (queuedIds.length === 0) {
      showToast("info", "No pending messages to check with gateway.", "All Up to Date");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/sms/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: gatewayConfig.username,
          password: gatewayConfig.password,
          baseUrl: gatewayConfig.baseUrl,
          ids: queuedIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.statuses) {
        let updatedCount = 0;
        Object.entries(data.statuses).forEach(([id, info]: [string, any]) => {
          if (info.state) {
            const isDone =
              info.state.toLowerCase() === "delivered" ||
              info.state.toLowerCase() === "sent";
            const isErr = info.state.toLowerCase().includes("fail");
            const newStatus = isDone ? "delivered" : isErr ? "failed" : "queued";

            const targetMsg = messages.find((m) => m.gatewayId === id);
            if (targetMsg) {
              updateMessageStatus(targetMsg.id, newStatus, info.state);
              updatedCount++;
            }
          }
        });
        showToast("success", `Updated ${updatedCount} message delivery states.`, "Gateway Synced");
      } else {
        showToast("warning", data.error || "Could not retrieve status update.", "Sync Warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Status sync failed";
      showToast("danger", msg, "Sync Error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredMessages.length === 0) return;
    const header = "ID,Phone,NationalFormat,Network,Status,GatewayMessageID,SIM,Timestamp,MessageText\n";
    const body = filteredMessages
      .map(
        (m) =>
          `"${m.id}","${m.phone}","${m.nationalPhone || ""}","${m.operator || ""}","${m.status}","${m.gatewayId || ""}","SIM ${m.simNumber || 1}","${m.timestamp}","${m.text.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sms_history_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to delete all message history? This action cannot be undone.")) {
      await clearMessages();
      showToast("info", "All message logs cleared.", "History Emptied");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <History className="h-3 w-3" />
                Audit Trail & Delivery Reports
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                📱 Gateway: {activeGw.username}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Message History & Logs
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive log of all cellular messages with live gateway polling and CSV export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncGatewayStatuses}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Checking Gateway..." : "Sync Gateway Status"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMessages.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Search & Filter Bar */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone number, message text, or Gateway ID..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Operator filter */}
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="all">All Networks</option>
              <option value="Jazz">Jazz / Mobilink</option>
              <option value="Zong">Zong</option>
              <option value="Telenor">Telenor</option>
              <option value="Ufone">Ufone</option>
              <option value="SCOM">SCOM</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="queued">Enqueued / Sending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Messages Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-md">
          {filteredMessages.length === 0 ? (
            <div className="py-16 text-center">
              <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No message records found</p>
              <p className="text-xs text-slate-500 mt-1">
                {messages.length === 0
                  ? "Messages sent via Single Test SMS or Bulk Campaign will appear here."
                  : "Try clearing your search query or adjusting status filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Recipient</th>
                    <th className="py-3 px-4 font-semibold">Network</th>
                    <th className="py-3 px-4 font-semibold">Message Text</th>
                    <th className="py-3 px-4 font-semibold">Gateway Status</th>
                    <th className="py-3 px-4 font-semibold">SIM Slot</th>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMessages.map((msg) => (
                    <tr
                      key={msg.id}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{msg.nationalPhone || msg.phone}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{msg.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <OperatorBadge operator={msg.operator} size="sm" />
                      </td>
                      <td className="py-3 px-4 max-w-sm truncate text-slate-300" title={msg.text}>
                        {msg.text}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={msg.status} stateText={msg.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        SIM {msg.simNumber || 1}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "--"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Message Log Details</h3>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient Phone:</span>
                <span className="font-semibold text-white">{selectedMessage.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">National Format:</span>
                <span className="font-semibold text-white">{selectedMessage.nationalPhone || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Network Operator:</span>
                <OperatorBadge operator={selectedMessage.operator} size="sm" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Delivery Status:</span>
                <StatusBadge status={selectedMessage.status} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gateway Message ID:</span>
                <span className="font-mono text-emerald-400">{selectedMessage.gatewayId || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SIM Slot Used:</span>
                <span className="text-white">SIM {selectedMessage.simNumber || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dispatched At:</span>
                <span className="text-white">
                  {selectedMessage.timestamp ? new Date(selectedMessage.timestamp).toLocaleString() : "--"}
                </span>
              </div>

              {selectedMessage.error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300">
                  <span className="font-bold block mb-1">Error Message:</span>
                  <span>{selectedMessage.error}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block mb-1">Message Content:</span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.text}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
