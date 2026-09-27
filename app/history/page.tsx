"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSms } from "@/lib/context/sms-context";
import { OperatorBadge } from "@/components/operator-badge";
import { StatusBadge } from "@/components/status-badge";
import { MessageRecord } from "@/lib/types";
import {
  History,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Clock,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square,
  Copy,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  Send,
  XCircle,
} from "lucide-react";

const AUTO_SYNC_INTERVAL_MS = 60_000; // 1 minute
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type SortField = "timestamp" | "phone" | "status" | "operator";
type SortDir = "asc" | "desc";

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

  // ---------- filters ----------
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ---------- sync ----------
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageRecord | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState(AUTO_SYNC_INTERVAL_MS / 1000);
  const [syncCount, setSyncCount] = useState(0);

  // ---------- sorting & pagination ----------
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // ---------- selection ----------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Snapshot of statuses at page-load ("original") keyed by message id
  const [originalStatuses, setOriginalStatuses] = useState<Record<string, MessageRecord["status"]>>({});
  const snapshotTaken = useRef(false);

  // Debounce search input -> searchQuery
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Take a one-time snapshot when messages first load
  useEffect(() => {
    if (!snapshotTaken.current && messages.length > 0) {
      const snap: Record<string, MessageRecord["status"]> = {};
      messages.forEach((m) => { snap[m.id] = m.status; });
      setOriginalStatuses(snap);
      snapshotTaken.current = true;
    }
  }, [messages]);

  // ---------- silent auto-refresh (DB pull only, no gateway poll) ----------
  const silentRefresh = useCallback(async () => {
    if (!activeGatewayUsername) return;
    await refreshMessages(activeGatewayUsername);
    setLastSyncedAt(new Date());
    setSyncCount((n) => n + 1);
    setNextSyncIn(AUTO_SYNC_INTERVAL_MS / 1000);
  }, [activeGatewayUsername, refreshMessages]);

  // countdown ticker + auto-refresh trigger
  useEffect(() => {
    const tick = setInterval(() => {
      setNextSyncIn((prev) => {
        if (prev <= 1) {
          silentRefresh();
          return AUTO_SYNC_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [silentRefresh]);

  // Close modal on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedMessage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- derived: filtered messages ----------
  const filteredMessages = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (operatorFilter !== "all" && m.operator !== operatorFilter) return false;

      if (fromTs || toTs) {
        const ts = m.timestamp ? new Date(m.timestamp).getTime() : null;
        if (ts === null) return false;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }

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
  }, [messages, statusFilter, operatorFilter, searchQuery, dateFrom, dateTo]);

  // ---------- derived: sorted ----------
  const sortedMessages = useMemo(() => {
    const arr = [...filteredMessages];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "timestamp":
          cmp = new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
          break;
        case "phone":
          cmp = (a.nationalPhone || a.phone || "").localeCompare(b.nationalPhone || b.phone || "");
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "operator":
          cmp = (a.operator || "").localeCompare(b.operator || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredMessages, sortField, sortDir]);

  // ---------- derived: pagination ----------
  const totalPages = Math.max(1, Math.ceil(sortedMessages.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedMessages.slice(start, start + pageSize);
  }, [sortedMessages, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, operatorFilter, dateFrom, dateTo, pageSize]);

  // ---------- derived: stats (based on filtered set, not just current page) ----------
  const stats = useMemo(() => {
    const total = filteredMessages.length;
    const delivered = filteredMessages.filter((m) => m.status === "delivered").length;
    const failed = filteredMessages.filter((m) => m.status === "failed").length;
    const queued = filteredMessages.filter((m) => m.status === "queued" || m.status === "sending").length;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { total, delivered, failed, queued, deliveryRate };
  }, [filteredMessages]);

  // How many messages changed status since page load
  const changedCount = useMemo(() => {
    return messages.filter(
      (m) => originalStatuses[m.id] && originalStatuses[m.id] !== m.status
    ).length;
  }, [messages, originalStatuses]);

  // ---------- sorting handler ----------
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-400" />
    );
  };

  // ---------- selection handlers ----------
  const isAllPageSelected =
    paginatedMessages.length > 0 && paginatedMessages.every((m) => selectedIds.has(m.id));

  const togglePageSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedMessages.forEach((m) => next.delete(m.id));
      } else {
        paginatedMessages.forEach((m) => next.add(m.id));
      }
      return next;
    });
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ---------- clipboard helper ----------
  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("success", `${label} copied to clipboard.`, "Copied");
    } catch {
      showToast("danger", "Could not copy to clipboard.", "Copy Failed");
    }
  };

  // Sync statuses with sms-gate.app for queued messages, then persist to DB
  const handleSyncGatewayStatuses = async () => {
    const pendingMessages = messages.filter(
      (m) => (m.status === "queued" || m.status === "sending") && m.gatewayId
    );
    const queuedIds = pendingMessages.map((m) => m.gatewayId as string).slice(0, 30);

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
        const updatedItems: { id: string; status: MessageRecord["status"]; state: string }[] = [];

        Object.entries(data.statuses).forEach(([gatewayId, info]: [string, unknown]) => {
          const infoObj = info as { state?: string };
          if (!infoObj.state) return;

          const state = infoObj.state.toLowerCase();
          const isDone = state === "delivered" || state === "sent";
          const isErr = state.includes("fail");
          const newStatus: MessageRecord["status"] = isDone ? "delivered" : isErr ? "failed" : "queued";

          const targetMsg = messages.find((m) => m.gatewayId === gatewayId);
          if (targetMsg && targetMsg.status !== newStatus) {
            updatedItems.push({ id: targetMsg.id, status: newStatus, state: infoObj.state! });
          }
        });

        if (updatedItems.length > 0) {
          updatedItems.forEach(({ id, status, state }) => {
            updateMessageStatus(id, status, state);
          });

          const itemsToSave = updatedItems
            .map(({ id, status, state }) => {
              const original = messages.find((m) => m.id === id);
              if (!original) return null;
              return { ...original, status, error: state };
            })
            .filter(Boolean) as MessageRecord[];

          if (itemsToSave.length > 0 && activeGatewayUsername) {
            try {
              await fetch(
                `/api/messages?gatewayUsername=${encodeURIComponent(activeGatewayUsername)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    gatewayUsername: activeGatewayUsername,
                    items: itemsToSave,
                  }),
                }
              );
            } catch {
              // DB save failed silently — local state is still updated
            }
          }

          setOriginalStatuses((prev) => {
            const next = { ...prev };
            updatedItems.forEach(({ id, status }) => {
              next[id] = status;
            });
            return next;
          });
        }

        setLastSyncedAt(new Date());
        setSyncCount((n) => n + 1);
        setNextSyncIn(AUTO_SYNC_INTERVAL_MS / 1000);
        showToast(
          "success",
          updatedItems.length > 0
            ? `Updated & saved ${updatedItems.length} message status${updatedItems.length > 1 ? "es" : ""} to database.`
            : "All pending messages already up-to-date.",
          "Gateway Synced"
        );
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

  // Manual DB refresh
  const handleManualRefresh = async () => {
    setIsSyncing(true);
    await silentRefresh();
    showToast("info", "Message history refreshed from database.", "Refreshed");
    setIsSyncing(false);
  };

  // Export helper — builds CSV from any message list
  const exportToCsv = (rows: MessageRecord[], filenamePrefix: string) => {
    if (rows.length === 0) return;
    const header = "ID,Phone,NationalFormat,Network,OriginalStatus,CurrentStatus,GatewayMessageID,SIM,Timestamp,MessageText\n";
    const body = rows
      .map((m) => {
        const orig = originalStatuses[m.id] || m.status;
        return `"${m.id}","${m.phone}","${m.nationalPhone || ""}","${m.operator || ""}","${orig}","${m.status}","${m.gatewayId || ""}","SIM ${m.simNumber || 1}","${m.timestamp}","${m.text.replace(/"/g, '""')}"`;
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filenamePrefix}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => exportToCsv(filteredMessages, "sms_history_export");

  const handleExportSelected = () => {
    const rows = messages.filter((m) => selectedIds.has(m.id));
    exportToCsv(rows, "sms_history_selected");
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to delete all message history? This action cannot be undone.")) {
      await clearMessages();
      setOriginalStatuses({});
      snapshotTaken.current = false;
      clearSelection();
      showToast("info", "All message logs cleared.", "History Emptied");
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("all");
    setOperatorFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    operatorFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <History className="h-3 w-3" />
                Audit Trail & Delivery Reports
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                📱 Gateway: {activeGw.username}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isMongoConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {isMongoConnected ? "DB Connected" : "DB Offline"}
              </span>
              {changedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="h-3 w-3" />
                  {changedCount} status{changedCount > 1 ? "es" : ""} changed since load
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Message History & Logs
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive log of all cellular messages — auto-syncs from DB every minute.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {lastSyncedAt
                  ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Waiting for first sync"}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-mono font-semibold tabular-nums">
                {nextSyncIn}s
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 shadow-sm transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Refresh DB</span>
            </button>

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
        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total Messages" value={stats.total} icon={<Send className="h-4 w-4" />} tone="slate" />
          <StatCard label="Delivered" value={stats.delivered} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
          <StatCard label="Queued / Sending" value={stats.queued} icon={<Clock className="h-4 w-4" />} tone="amber" />
          <StatCard label="Failed" value={stats.failed} icon={<XCircle className="h-4 w-4" />} tone="rose" />
          <StatCard
            label="Delivery Rate"
            value={`${stats.deliveryRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="sky"
          />
        </div>

        {/* Sync stats bar */}
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>
            Auto-sync every <span className="text-emerald-400 font-semibold">60 s</span> — pulls latest records from MongoDB.
            {syncCount > 0 && (
              <span className="ml-2">
                Completed <span className="text-slate-300 font-semibold">{syncCount}</span> sync{syncCount > 1 ? "s" : ""} this session.
              </span>
            )}
          </span>
          {changedCount > 0 && (
            <span className="ml-auto text-amber-400 font-semibold">
              ↑ {changedCount} row{changedCount > 1 ? "s" : ""} updated since page load
            </span>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by phone number, message text, or Gateway ID..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
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

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-slate-800/60 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 w-full sm:w-auto">
              <span className="shrink-0">Date range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk selection action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <span className="text-xs font-semibold text-emerald-300">
              {selectedIds.size} message{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition"
              >
                <Download className="h-3.5 w-3.5" />
                Export Selected
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Messages Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-md">
          {sortedMessages.length === 0 ? (
            <div className="py-16 text-center">
              <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No message records found</p>
              <p className="text-xs text-slate-500 mt-1">
                {messages.length === 0
                  ? "Messages sent via Single Test SMS or Bulk Campaign will appear here."
                  : "Try clearing your search query or adjusting filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                      <th className="py-3 px-4 w-10">
                        <button type="button" onClick={togglePageSelectAll} className="flex items-center">
                          {isAllPageSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-600" />
                          )}
                        </button>
                      </th>
                      <SortableHeader label="Recipient" field="phone" sortField={sortField} onSort={toggleSort} />
                      <SortableHeader label="Network" field="operator" sortField={sortField} onSort={toggleSort} />
                      <th className="py-3 px-4 font-semibold">Message Text</th>
                      <SortableHeader label="Status" field="status" sortField={sortField} onSort={toggleSort} />
                      <th className="py-3 px-4 font-semibold">SIM Slot</th>
                      <SortableHeader label="Timestamp" field="timestamp" sortField={sortField} onSort={toggleSort} />
                      <th className="py-3 px-4 font-semibold text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedMessages.map((msg) => {
                      const origStatus = originalStatuses[msg.id];
                      const hasChanged = origStatus && origStatus !== msg.status;
                      const isSelected = selectedIds.has(msg.id);
                      return (
                        <tr
                          key={msg.id}
                          className={`hover:bg-slate-800/40 transition cursor-pointer ${
                            hasChanged ? "bg-amber-500/5" : ""
                          } ${isSelected ? "bg-emerald-500/5" : ""}`}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => toggleRowSelect(msg.id)} className="flex items-center">
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-600" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-bold text-white" onClick={() => setSelectedMessage(msg)}>
                            <div>{msg.nationalPhone || msg.phone}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{msg.phone}</div>
                          </td>
                          <td className="py-3 px-4" onClick={() => setSelectedMessage(msg)}>
                            <OperatorBadge operator={msg.operator} size="sm" />
                          </td>
                          <td
                            className="py-3 px-4 max-w-sm truncate text-slate-300"
                            title={msg.text}
                            onClick={() => setSelectedMessage(msg)}
                          >
                            {msg.text}
                          </td>
                          <td className="py-3 px-4" onClick={() => setSelectedMessage(msg)}>
                            {hasChanged ? (
                              <div className="flex items-center gap-1.5">
                                <StatusBadge status={origStatus} stateText={origStatus} size="sm" />
                                <ArrowRight className="h-3 w-3 text-amber-400 shrink-0" />
                                <StatusBadge status={msg.status} stateText={msg.status} size="sm" />
                              </div>
                            ) : (
                              <StatusBadge status={msg.status} stateText={msg.status} size="sm" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400" onClick={() => setSelectedMessage(msg)}>
                            SIM {msg.simNumber || 1}
                          </td>
                          <td
                            className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap"
                            onClick={() => setSelectedMessage(msg)}
                          >
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "--"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedMessage(msg)}
                              className="text-emerald-400 hover:text-emerald-300 font-semibold"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/60 px-4 py-3">
                <span className="text-[11px] text-slate-500">
                  Showing{" "}
                  <span className="text-slate-300 font-semibold">
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedMessages.length)}
                  </span>{" "}
                  of <span className="text-slate-300 font-semibold">{sortedMessages.length}</span> messages
                  {sortedMessages.length !== messages.length && (
                    <span className="text-slate-600"> (filtered from {messages.length})</span>
                  )}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-400 px-2 font-mono">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Message Detail Modal */}
      {selectedMessage && (() => {
        const origStatus = originalStatuses[selectedMessage.id];
        const hasChanged = origStatus && origStatus !== selectedMessage.status;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setSelectedMessage(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">Message Log Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Recipient Phone:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{selectedMessage.phone}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedMessage.phone, "Phone number")}
                      className="text-slate-500 hover:text-emerald-400 transition"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">National Format:</span>
                  <span className="font-semibold text-white">{selectedMessage.nationalPhone || "--"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Network Operator:</span>
                  <OperatorBadge operator={selectedMessage.operator} size="sm" />
                </div>

                {hasChanged ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <p className="text-amber-400 font-semibold text-[11px] uppercase tracking-wide">Status Changed This Session</p>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Original Status:</span>
                      <StatusBadge status={origStatus} stateText={origStatus} size="sm" />
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Current Status:</span>
                      <StatusBadge status={selectedMessage.status} stateText={selectedMessage.status} size="sm" />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Delivery Status:</span>
                    <StatusBadge status={selectedMessage.status} size="sm" />
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Gateway Message ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-emerald-400">{selectedMessage.gatewayId || "N/A"}</span>
                    {selectedMessage.gatewayId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedMessage.gatewayId!, "Gateway ID")}
                        className="text-slate-500 hover:text-emerald-400 transition"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
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
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400">Message Content:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedMessage.text, "Message text")}
                      className="flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition text-[11px]"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedMessage.text}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 text-right">
                    {selectedMessage.text.length} characters ·{" "}
                    {Math.ceil(selectedMessage.text.length / 160)} SMS segment
                    {Math.ceil(selectedMessage.text.length / 160) > 1 ? "s" : ""}
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
        );
      })()}
    </div>
  );
}

// ---------- helper components ----------

function SortableHeader({
  label,
  field,
  sortField,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className="py-3 px-4 font-semibold">
      <button type="button" onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-white transition">
        {label}
        {sortField === field ? (
          <ArrowUpDown className="h-3 w-3 text-emerald-400" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-600" />
        )}
      </button>
    </th>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky";
}) {
  const toneMap: Record<string, string> = {
    slate: "text-slate-300 bg-slate-800/60 border-slate-700/60",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  };
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border mb-2 ${toneMap[tone]}`}>
        {icon}
      </div>
      <div className="text-lg font-extrabold text-white tabular-nums">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}