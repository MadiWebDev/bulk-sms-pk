"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import { useSms } from "@/lib/context/sms-context";
import {
  validatePakistanPhone,
  validatePakistanPhoneBatch,
  PakistanOperator,
} from "@/lib/pakistan-phone";
import { calculateSMSAttributes, interpolateTemplate } from "@/lib/sms-text";
import { OperatorBadge } from "@/components/operator-badge";
import { StatusBadge } from "@/components/status-badge";
import { MessageRecord, CampaignRecord } from "@/lib/types";
import {
  Send,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Download,
  Layers,
  Sparkles,
  Smartphone,
  Sliders,
  XCircle,
  CalendarClock,
  Search,
  ShieldOff,
  Save,
  FolderOpen,
  Wand2,
  Trash2,
  RefreshCw,
  Timer,
  FileUp,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DRAFTS_STORAGE_KEY = "bulk_sms_drafts_v1";
const OPTOUT_STORAGE_KEY = "bulk_sms_optout_v1";
const CHECKPOINT_STORAGE_KEY = "bulk_sms_checkpoint_v2";
/** Flush sent records to DB every N messages to avoid data loss on navigation */
const DB_FLUSH_EVERY = 50;
/** Max rows shown in the live stream to avoid DOM overload */
const STREAM_WINDOW = 150;

// ─── Types ────────────────────────────────────────────────────────────────────
type BulkMode = "direct" | "csv" | "group";
type ScheduleState = "idle" | "scheduled" | "running";
type StreamFilter = "all" | ProcessRow["status"];

interface ProcessRow {
  index: number;
  phone: string;
  nationalPhone?: string;
  operator?: PakistanOperator;
  text: string;
  status: "pending" | "sending" | "queued" | "failed" | "delivered";
  error?: string;
  id?: string;
  attempts?: number;
}

interface CampaignDraft {
  id: string;
  name: string;
  savedAt: string;
  mode: BulkMode;
  directNumbersRaw: string;
  csvRaw: string;
  messageTemplate: string;
  campaignTitle: string;
  filterOperator: string;
  delayMs: number;
  jitterEnabled: boolean;
  batchSize: number;
  selectedSim: number;
}

interface CampaignCheckpoint {
  campaignId: string;
  campaignTitle: string;
  gatewayUsername: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  /** Indices into the original preparedRows that are still pending */
  remainingBatchStart: number;
  /** Snapshot of all rows so progress display works after resume */
  rowSnapshot: ProcessRow[];
  savedAt: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function saveCheckpointLS(cp: CampaignCheckpoint) {
  try {
    localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(cp));
  } catch {}
}
function clearCheckpointLS() {
  try {
    localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {}
}
function loadCheckpointLS(): CampaignCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CampaignCheckpoint) : null;
  } catch {
    return null;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
function BulkSmsInner() {
  const {
    gatewayConfig,
    contacts,
    contactGroups,
    templates,
    addMessages,
    addCampaign,
    showToast,
    activeGatewayUsername,
  } = useSms();
  const searchParams = useSearchParams();

  // ── Template pre-fill from URL ──────────────────────────────────────────────
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);
  useEffect(() => {
    const templateId = searchParams.get("templateId");
    if (templateId && templates.length > 0) {
      const found = templates.find((t) => t.id === templateId);
      if (found) {
        setMessageTemplate(found.text);
        setLoadedTemplateName(found.name);
        showToast("info", `Template "${found.name}" loaded.`, "Template Loaded");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  // ── Mode / inputs ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<BulkMode>("direct");
  const [campaignTitle, setCampaignTitle] = useState("Flash Sale Campaign - All Pakistan");
  const [directNumbersRaw, setDirectNumbersRaw] = useState(
    "03001234567\n03121234567\n03331234567\n03451234567\n+923211234567\n923011234567"
  );
  const [csvRaw, setCsvRaw] = useState(
    "phone,name,order_id,amount\n03001234567,Ahmed Khan,9021,2500\n03121234567,Fatima Noor,9022,4200\n03331234567,Bilal Tariq,9023,1800\n03451234567,Zainab Ali,9024,3100"
  );
  const [phoneColumnOverride, setPhoneColumnOverride] = useState("");
  const [nameColumnOverride, setNameColumnOverride] = useState("");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(
    "Salam {name}! Exclusive mega sale: FLAT 30% OFF on all items today only. Order now: https://store.pk/sale Code: PK30. Delivery all over Pakistan! 🇵🇰"
  );
  const [spintaxEnabled, setSpintaxEnabled] = useState(false);

  // ── Settings ────────────────────────────────────────────────────────────────
  const [selectedSim, setSelectedSim] = useState<number>(gatewayConfig.simNumber || 1);
  const [simSlotCount, setSimSlotCount] = useState<number>(2);
  const [delayMs, setDelayMs] = useState<number>(5000);
  const [jitterEnabled, setJitterEnabled] = useState<boolean>(true);
  const [batchSize, setBatchSize] = useState<number>(1);
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [deduplicate, setDeduplicate] = useState<boolean>(true);

  // ── Opt-out list ────────────────────────────────────────────────────────────
  const [optOutRaw, setOptOutRaw] = useState<string>("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPTOUT_STORAGE_KEY);
      if (saved) setOptOutRaw(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(OPTOUT_STORAGE_KEY, optOutRaw);
    } catch {}
  }, [optOutRaw]);
  const optOutSet = useMemo(() => {
    const set = new Set<string>();
    optOutRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((l) => {
        const v = validatePakistanPhone(l);
        if (v.isValid && v.e164) set.add(v.e164);
      });
    return set;
  }, [optOutRaw]);

  // ── Scheduling ──────────────────────────────────────────────────────────────
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleState, setScheduleState] = useState<ScheduleState>("idle");
  const [countdownLabel, setCountdownLabel] = useState("");
  const scheduleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Execution state ─────────────────────────────────────────────────────────
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);
  const executionStartRef = useRef(0);
  /**
   * processRowsRef is the SINGLE source of truth during execution.
   * We avoid calling setProcessRows(prev => prev.map(...)) on every message
   * because with 5000 rows that's O(5000) on every update = extremely slow.
   * Instead we mutate the ref directly and call setProcessRows only to push
   * a NEW array reference to React so the UI re-renders.
   */
  const processRowsRef = useRef<ProcessRow[]>([]);
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [currentProgress, setCurrentProgress] = useState({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
  });
  const [etaLabel, setEtaLabel] = useState("");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [sendRateLabel, setSendRateLabel] = useState(""); // "12/min"

  // ── Stream UI ───────────────────────────────────────────────────────────────
  const [streamSearch, setStreamSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");
  const [streamExpanded, setStreamExpanded] = useState(true);

  // ── Resume banner ───────────────────────────────────────────────────────────
  const [pendingCheckpoint, setPendingCheckpoint] =
    useState<CampaignCheckpoint | null>(null);
  useEffect(() => {
    const cp = loadCheckpointLS();
    if (cp && cp.gatewayUsername === (activeGatewayUsername || gatewayConfig.username)) {
      setPendingCheckpoint(cp);
    }
  }, [activeGatewayUsername, gatewayConfig.username]);

  // ── Drafts ──────────────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {}
  }, []);
  const persistDrafts = (next: CampaignDraft[]) => {
    setDrafts(next);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // ── Parsing ─────────────────────────────────────────────────────────────────
  const directBatch = useMemo(() => {
    const rawLines = directNumbersRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return validatePakistanPhoneBatch(rawLines, deduplicate);
  }, [directNumbersRaw, deduplicate]);

  const { csvHeaders, csvRows, csvBatch } = useMemo(() => {
    const lines = csvRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2)
      return {
        csvHeaders: [],
        csvRows: [],
        csvBatch: {
          valid: [],
          excluded: [],
          duplicatesCount: 0,
          operatorStats: {} as Record<string, number>,
        },
      };
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const autoPhoneIdx = headers.findIndex(
      (h) => h.includes("phone") || h.includes("mobile") || h.includes("num")
    );
    const phoneColIdx =
      phoneColumnOverride && headers.includes(phoneColumnOverride)
        ? headers.indexOf(phoneColumnOverride)
        : autoPhoneIdx;
    const activePhoneIdx = phoneColIdx !== -1 ? phoneColIdx : 0;
    const parsedRows: Array<{ phone: string; [k: string]: string }> = [];
    const phoneInputs: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      const rawPhone = parts[activePhoneIdx] || "";
      const rowObj: { phone: string; [k: string]: string } = { phone: rawPhone };
      headers.forEach((h, idx) => { rowObj[h] = parts[idx] || ""; });
      rowObj.phone = rawPhone;
      if (nameColumnOverride && headers.includes(nameColumnOverride))
        rowObj.name = parts[headers.indexOf(nameColumnOverride)] || rowObj.name || "";
      parsedRows.push(rowObj);
      phoneInputs.push(rawPhone);
    }
    const batch = validatePakistanPhoneBatch(phoneInputs, deduplicate);
    return { csvHeaders: headers, csvRows: parsedRows, csvBatch: batch };
  }, [csvRaw, deduplicate, phoneColumnOverride, nameColumnOverride]);

  const groupBatch = useMemo(() => {
    const filtered = selectedGroup
      ? contacts.filter((c) => c.group === selectedGroup)
      : contacts;
    return {
      contacts: filtered,
      batch: validatePakistanPhoneBatch(
        filtered.map((c) => c.phone),
        deduplicate
      ),
    };
  }, [contacts, selectedGroup, deduplicate]);

  const activeStats = useMemo(() => {
    if (mode === "direct") return directBatch;
    if (mode === "csv") return csvBatch;
    return groupBatch.batch;
  }, [mode, directBatch, csvBatch, groupBatch]);

  const resolveSpintax = useCallback((text: string): string => {
    return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, group: string) => {
      const opts = group.split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }, []);

  const { preparedRows, suppressedCount } = useMemo(() => {
    const rows: ProcessRow[] = [];
    let suppressed = 0;
    const buildText = (vars: Record<string, string | undefined>) => {
      const base = spintaxEnabled ? resolveSpintax(messageTemplate) : messageTemplate;
      return interpolateTemplate(base, vars);
    };
    const push = (e164: string, row: Omit<ProcessRow, "status">) => {
      if (optOutSet.has(e164)) { suppressed++; return; }
      rows.push({ ...row, status: "pending" });
    };
    if (mode === "direct") {
      directBatch.valid.forEach((val, idx) => {
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        push(val.e164 || "", {
          index: idx,
          phone: val.e164 || "",
          nationalPhone: val.national,
          operator: val.operator,
          text: buildText({ name: "Customer", phone: val.national || val.e164, operator: val.operator }),
        });
      });
    } else if (mode === "csv") {
      csvRows.forEach((row, idx) => {
        const val = validatePakistanPhone(row.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        push(val.e164, {
          index: idx, phone: val.e164, nationalPhone: val.national, operator: val.operator,
          text: buildText({ ...row, operator: val.operator }),
        });
      });
    } else {
      groupBatch.contacts.forEach((contact, idx) => {
        const val = validatePakistanPhone(contact.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        push(val.e164, {
          index: idx, phone: val.e164, nationalPhone: val.national, operator: val.operator,
          text: buildText({ name: contact.name, phone: contact.nationalPhone || contact.phone, operator: contact.operator, group: contact.group }),
        });
      });
    }
    return { preparedRows: rows, suppressedCount: suppressed };
  }, [mode, directBatch, csvRows, groupBatch, filterOperator, messageTemplate, spintaxEnabled, resolveSpintax, optOutSet]);

  const sampleAttrs = useMemo(() => calculateSMSAttributes(messageTemplate), [messageTemplate]);

  // ── Stream (windowed to STREAM_WINDOW for perf) ─────────────────────────────
  const filteredProcessRows = useMemo(() => {
    let rows = processRows;
    if (streamFilter !== "all") rows = rows.filter((r) => r.status === streamFilter);
    if (streamSearch.trim()) {
      const q = streamSearch.trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.phone} ${r.nationalPhone || ""} ${r.text}`.toLowerCase().includes(q)
      );
    }
    // Show the LAST N rows (most recent activity) for large campaigns
    return rows.slice(-STREAM_WINDOW);
  }, [processRows, streamFilter, streamSearch]);

  // ── beforeunload warning when campaign is running ───────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isExecuting) {
        e.preventDefault();
        e.returnValue =
          "A campaign is running. Leaving now will interrupt it — progress is saved every 50 messages.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isExecuting]);

  // ── Core send loop ──────────────────────────────────────────────────────────
  const runCampaign = useCallback(
    async (rowsToSend: ProcessRow[], resumeFrom = 0) => {
      if (rowsToSend.length === 0) {
        showToast("warning", "No valid recipients to send to.", "Empty Campaign");
        return;
      }

      setIsExecuting(true);
      setIsPaused(false);
      isCancelledRef.current = false;
      isPausedRef.current = false;
      executionStartRef.current = Date.now();

      // ── Init row state ──
      const initialRows: ProcessRow[] = rowsToSend.map((r, i) => ({
        ...r,
        status: i < resumeFrom ? r.status : "pending",
        attempts: i < resumeFrom ? r.attempts : 0,
      }));
      processRowsRef.current = initialRows;
      setProcessRows([...initialRows]);
      setCurrentProgress({ total: initialRows.length, completed: resumeFrom, success: 0, failed: 0 });

      const campaignId = activeCampaignId || `cmp_${Date.now()}`;
      setActiveCampaignId(campaignId);

      let successCount = 0;
      let failCount = 0;
      // Count already-done rows if resuming
      for (let i = 0; i < resumeFrom; i++) {
        if (initialRows[i].status === "queued" || initialRows[i].status === "delivered") successCount++;
        else if (initialRows[i].status === "failed") failCount++;
      }

      // Accumulator — flushed to DB every DB_FLUSH_EVERY messages
      let pendingFlush: MessageRecord[] = [];

      // ── Helpers ──
      const jitteredDelay = (base: number): number => {
        if (!jitterEnabled || base === 0) return base;
        const v = base * 0.3;
        return Math.round(base - v + Math.random() * v * 2);
      };

      /** Flush pendingFlush to DB and clear it */
      const flushToDB = async (records: MessageRecord[]) => {
        if (records.length === 0) return;
        try {
          await addMessages(records);
        } catch {}
      };

      /** Save a lightweight checkpoint to localStorage (and optionally DB) */
      const checkpoint = (batchStart: number) => {
        const cp: CampaignCheckpoint = {
          campaignId,
          campaignTitle,
          gatewayUsername: gatewayConfig.username,
          totalRecipients: initialRows.length,
          sentCount: successCount,
          failedCount: failCount,
          remainingBatchStart: batchStart,
          rowSnapshot: processRowsRef.current.map((r) => ({ ...r })),
          savedAt: new Date().toISOString(),
        };
        saveCheckpointLS(cp);
        // Fire-and-forget to DB
        fetch("/api/campaigns/checkpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...cp,
            config: {
              username: gatewayConfig.username,
              baseUrl: gatewayConfig.baseUrl,
              deviceId: gatewayConfig.deviceId,
              simNumber: selectedSim,
              delayMs,
              jitterEnabled,
              batchSize,
            },
          }),
        }).catch(() => {});
      };

      // ── Batch builder ──
      interface Batch {
        rows: ProcessRow[];
        indices: number[];
        text: string;
        phones: string[];
      }
      const buildBatches = (rows: ProcessRow[], startIdx: number): Batch[] => {
        if (batchSize <= 1) {
          return rows.map((r, i) => ({
            rows: [r], indices: [startIdx + i], text: r.text, phones: [r.phone],
          }));
        }
        const batches: Batch[] = [];
        let i = 0;
        while (i < rows.length) {
          const anchor = rows[i];
          const group = [anchor];
          const gIdx = [startIdx + i];
          while (
            group.length < batchSize &&
            i + group.length < rows.length &&
            rows[i + group.length].text === anchor.text
          ) {
            group.push(rows[i + group.length]);
            gIdx.push(startIdx + i + group.length - 1);
          }
          batches.push({ rows: group, indices: gIdx, text: anchor.text, phones: group.map((r) => r.phone) });
          i += group.length;
        }
        return batches;
      };

      const rowsToProcess = initialRows.slice(resumeFrom);
      const batches = buildBatches(rowsToProcess, resumeFrom);
      let completedMessages = resumeFrom;
      const totalRows = initialRows.length;
      let rateWindowStart = Date.now();
      let rateWindowCount = 0;

      for (let b = 0; b < batches.length; b++) {
        if (isCancelledRef.current) break;
        while (isPausedRef.current && !isCancelledRef.current) {
          await new Promise((r) => setTimeout(r, 300));
        }

        const batch = batches[b];

        // Mark sending — direct mutation + one React update
        batch.indices.forEach((idx) => {
          processRowsRef.current[idx] = { ...processRowsRef.current[idx], status: "sending" };
        });
        setProcessRows([...processRowsRef.current]);

        // Delay (skip for very first batch)
        if (b > 0 && delayMs > 0) {
          await new Promise((r) => setTimeout(r, jitteredDelay(delayMs)));
        }

        // ── Send once — no automatic retries inside the loop.
        // If it fails it lands as "failed" in the stream.
        // The user then clicks "Retry Failed" to re-send only those rows.
        // This gives full visibility: every result (success or failure) is shown
        // immediately and the user decides whether and when to retry.
        let attempt = 1;
        let ok = false;
        let lastError = "";
        let lastResultId: string | undefined;

        try {
          const res = await fetch("/api/sms/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: gatewayConfig.username,
              password: gatewayConfig.password,
              baseUrl: gatewayConfig.baseUrl,
              deviceId: gatewayConfig.deviceId,
              simNumber: selectedSim,
              withDeliveryReport: true,
              gatewayUsername: gatewayConfig.username,
              campaignId,
              campaignTitle,
              items: [{ phoneNumbers: batch.phones, text: batch.text }],
            }),
          });
          const data = await res.json().catch(() => ({}));
          const result = data?.results?.[0];
          if (res.ok && result?.ok) {
            ok = true;
            lastResultId = result.id;
          } else {
            lastError = result?.error || data?.error || `HTTP ${res.status}`;
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : "Network error";
        }

        // ── Update row state + build records ──
        batch.rows.forEach((row, bIdx) => {
          const rowIdx = batch.indices[bIdx];
          if (ok) {
            successCount++;
            rateWindowCount++;
            const rec: MessageRecord = {
              id: lastResultId ? `${lastResultId}_${row.phone.slice(-4)}` : `msg_${Date.now()}_${rowIdx}`,
              phone: row.phone,
              nationalPhone: row.nationalPhone,
              operator: row.operator,
              text: row.text,
              status: "queued",
              gatewayId: lastResultId,
              timestamp: new Date().toISOString(),
              campaignId,
              campaignTitle,
              simNumber: selectedSim,
            };
            pendingFlush.push(rec);
            processRowsRef.current[rowIdx] = { ...processRowsRef.current[rowIdx], status: "queued", id: lastResultId, attempts: attempt };
          } else {
            failCount++;
            const rec: MessageRecord = {
              id: `msg_err_${Date.now()}_${rowIdx}`,
              phone: row.phone,
              nationalPhone: row.nationalPhone,
              operator: row.operator,
              text: row.text,
              status: "failed",
              error: lastError,
              timestamp: new Date().toISOString(),
              campaignId,
              campaignTitle,
              simNumber: selectedSim,
            };
            pendingFlush.push(rec);
            processRowsRef.current[rowIdx] = { ...processRowsRef.current[rowIdx], status: "failed", error: lastError, attempts: attempt };
          }
        });

        completedMessages += batch.rows.length;

        // Single React update after processing the batch
        setProcessRows([...processRowsRef.current]);
        setCurrentProgress({ total: totalRows, completed: completedMessages, success: successCount, failed: failCount });

        // ── ETA ──
        const remaining = totalRows - completedMessages;
        const elapsed = Date.now() - executionStartRef.current;
        const perItem = completedMessages > resumeFrom ? elapsed / (completedMessages - resumeFrom) : delayMs;
        const remainMs = Math.max(0, Math.round(perItem * remaining));
        const mins = Math.floor(remainMs / 60000);
        const secs = Math.floor(remainMs / 1000) % 60;
        setEtaLabel(remaining > 0 ? `~${mins}m ${secs}s left` : "");

        // ── Send rate ──
        const rateElapsed = (Date.now() - rateWindowStart) / 60000;
        if (rateElapsed > 0) setSendRateLabel(`${Math.round(rateWindowCount / rateElapsed)}/min`);

        // ── Periodic DB flush + checkpoint every DB_FLUSH_EVERY messages ──
        if (pendingFlush.length >= DB_FLUSH_EVERY) {
          const toFlush = [...pendingFlush];
          pendingFlush = [];
          await flushToDB(toFlush);
          checkpoint(completedMessages);
        }
      }

      // ── Final flush ──
      if (pendingFlush.length > 0) {
        await flushToDB(pendingFlush);
      }

      // ── Campaign record ──
      const campaignRecord: CampaignRecord = {
        id: campaignId,
        title: campaignTitle,
        createdAt: new Date().toISOString(),
        totalRecipients: totalRows,
        sentCount: successCount,
        failedCount: failCount,
        operatorStats: activeStats.operatorStats,
        status: isCancelledRef.current ? "cancelled" : "completed",
        textTemplate: messageTemplate,
        simNumber: selectedSim,
      };
      addCampaign(campaignRecord);

      // ── Cleanup checkpoint ──
      if (!isCancelledRef.current) {
        clearCheckpointLS();
        setPendingCheckpoint(null);
        fetch(`/api/campaigns/checkpoint?campaignId=${campaignId}&gatewayUsername=${encodeURIComponent(gatewayConfig.username)}`, {
          method: "DELETE",
        }).catch(() => {});
      }

      setIsExecuting(false);
      setEtaLabel("");
      setSendRateLabel("");
      setActiveCampaignId(null);
      showToast(
        failCount === 0 ? "success" : successCount === 0 ? "danger" : "warning",
        `Campaign done: ${successCount} queued${failCount > 0 ? `, ${failCount} failed` : ""}.`,
        "Campaign Finished"
      );
    },
    [
      gatewayConfig,
      selectedSim,
      campaignTitle,
      delayMs,
      jitterEnabled,
      batchSize,
      activeStats.operatorStats,
      messageTemplate,
      addMessages,
      addCampaign,
      showToast,
      activeCampaignId,
    ]
  );

  // ── Launch / schedule ───────────────────────────────────────────────────────
  const handleStartCampaign = () => {
    if (preparedRows.length === 0) {
      showToast("warning", "No valid recipients match the current filter.", "Empty Campaign");
      return;
    }
    if (isScheduled && scheduledAt) {
      const targetTime = new Date(scheduledAt).getTime();
      const msUntil = targetTime - Date.now();
      if (msUntil <= 0) {
        showToast("warning", "Scheduled time must be in the future.", "Invalid Schedule");
        return;
      }
      setScheduleState("scheduled");
      scheduleTimeoutRef.current = setTimeout(() => {
        setScheduleState("running");
        runCampaign(preparedRows);
      }, msUntil);
      countdownIntervalRef.current = setInterval(() => {
        const msLeft = targetTime - Date.now();
        if (msLeft <= 0) {
          setCountdownLabel("Starting now…");
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return;
        }
        const h = Math.floor(msLeft / 3600000);
        const m = Math.floor((msLeft % 3600000) / 60000);
        const s = Math.floor((msLeft % 60000) / 1000);
        setCountdownLabel(`${h > 0 ? `${h}h ` : ""}${m}m ${s}s until launch`);
      }, 1000);
      showToast("info", `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}.`, "Scheduled");
      return;
    }
    setActiveCampaignId(`cmp_${Date.now()}`);
    runCampaign(preparedRows);
  };

  const handleCancelSchedule = () => {
    if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setScheduleState("idle");
    setCountdownLabel("");
    showToast("info", "Scheduled campaign cancelled.", "Schedule Cancelled");
  };

  useEffect(() => {
    return () => {
      if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handlePauseResume = () => {
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      showToast("info", "Campaign resumed.", "Resumed");
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      showToast("warning", "Campaign paused — progress is saved.", "Paused");
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsExecuting(false);
    showToast("warning", "Campaign stopped. Progress was saved to DB.", "Stopped");
  };

  const handleRetryFailed = () => {
    const failedRows = processRows.filter((r) => r.status === "failed");
    if (failedRows.length === 0) {
      showToast("info", "No failed messages to retry.", "Nothing to Retry");
      return;
    }
    // Re-send only failed rows, keeping the same campaignId so history records
    // are updated in-place rather than creating a second campaign entry.
    showToast("info", `Re-sending ${failedRows.length} failed message${failedRows.length > 1 ? "s" : ""}…`, "Retrying");
    runCampaign(failedRows);
  };

  // ── Resume from checkpoint ──────────────────────────────────────────────────
  const handleResumeCheckpoint = () => {
    if (!pendingCheckpoint) return;
    const rows = pendingCheckpoint.rowSnapshot;
    const resumeFrom = pendingCheckpoint.remainingBatchStart;
    setActiveCampaignId(pendingCheckpoint.campaignId);
    setPendingCheckpoint(null);
    runCampaign(rows, resumeFrom);
  };
  const handleDismissCheckpoint = () => {
    clearCheckpointLS();
    setPendingCheckpoint(null);
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportReport = () => {
    if (processRows.length === 0) return;
    const header = "Phone,National,Operator,Status,Attempts,GatewayID,Error,Message\n";
    const body = processRows
      .map(
        (r) =>
          `"${r.phone}","${r.nationalPhone || ""}","${r.operator || ""}","${r.status}","${r.attempts ?? 1}","${r.id || ""}","${(r.error || "").replace(/"/g, '""')}","${r.text.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `sms_campaign_report_${Date.now()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleInsertTag = (tag: string) =>
    setMessageTemplate((prev) => `${prev} {${tag}}`);

  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvRaw(String(reader.result || "").trim());
      setPhoneColumnOverride("");
      setNameColumnOverride("");
      showToast("success", `Loaded ${file.name}.`, "File Loaded");
    };
    reader.onerror = () => showToast("error", "Could not read that file.", "Upload Failed");
    reader.readAsText(file);
  };

  const handleCsvFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readCsvFile(file);
    e.target.value = "";
  };

  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readCsvFile(file);
  };

  // ── Drafts ──────────────────────────────────────────────────────────────────
  const handleSaveDraft = () => {
    const name = campaignTitle || `Draft ${drafts.length + 1}`;
    const draft: CampaignDraft = {
      id: `draft_${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      mode,
      directNumbersRaw,
      csvRaw,
      messageTemplate,
      campaignTitle,
      filterOperator,
      delayMs,
      jitterEnabled,
      batchSize,
      selectedSim,
    };
    persistDrafts([draft, ...drafts].slice(0, 20));
    showToast("success", `Saved draft "${name}".`, "Draft Saved");
  };

  const handleLoadDraft = (draft: CampaignDraft) => {
    setMode(draft.mode);
    setDirectNumbersRaw(draft.directNumbersRaw);
    setCsvRaw(draft.csvRaw);
    setMessageTemplate(draft.messageTemplate);
    setCampaignTitle(draft.campaignTitle);
    setFilterOperator(draft.filterOperator);
    setDelayMs(draft.delayMs);
    setJitterEnabled(draft.jitterEnabled ?? true);
    setBatchSize(draft.batchSize ?? 1);
    setSelectedSim(draft.selectedSim);
    showToast("info", `Loaded draft "${draft.name}".`, "Draft Loaded");
  };

  const simSlotOptions = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(simSlotCount, 12)) }, (_, i) => i + 1),
    [simSlotCount]
  );

  const pct = currentProgress.total > 0
    ? Math.round((currentProgress.completed / currentProgress.total) * 100)
    : 0;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Send className="h-3 w-3" />
                Bulk Campaign Dispatcher
              </span>
              {isExecuting && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  <Activity className="h-3 w-3" />
                  Running — {pct}% ({currentProgress.completed}/{currentProgress.total})
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Personalized Bulk SMS Engine
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Sends up to 5 000+ messages reliably — progress auto-saved every {DB_FLUSH_EVERY} messages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSaveDraft}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition">
              <Save className="h-3.5 w-3.5" /> Save Draft
            </button>
            <input type="text" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              placeholder="Campaign Title..." />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* ── Resume banner ──────────────────────────────────────────────── */}
        {pendingCheckpoint && !isExecuting && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Interrupted campaign found
              </p>
              <p className="text-xs text-amber-200/70 mt-0.5">
                <span className="font-semibold">{pendingCheckpoint.campaignTitle}</span>
                &nbsp;—&nbsp;{pendingCheckpoint.sentCount} sent, {pendingCheckpoint.failedCount} failed out of {pendingCheckpoint.totalRecipients}.
                Saved {new Date(pendingCheckpoint.savedAt).toLocaleTimeString()}.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={handleResumeCheckpoint}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition">
                Resume from #{pendingCheckpoint.remainingBatchStart}
              </button>
              <button type="button" onClick={handleDismissCheckpoint}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">
                Discard
              </button>
            </div>
          </div>
        )}

        {/* ── Drafts row ─────────────────────────────────────────────────── */}
        {drafts.length > 0 && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 flex items-center gap-2 overflow-x-auto">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              <FolderOpen className="h-3.5 w-3.5" /> Drafts
            </span>
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-1.5 shrink-0 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1">
                <button type="button" onClick={() => handleLoadDraft(d)}
                  className="text-xs text-slate-300 hover:text-emerald-400 font-medium">{d.name}</button>
                <button type="button" onClick={() => persistDrafts(drafts.filter((x) => x.id !== d.id))}
                  className="text-slate-600 hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* ── Mode tabs ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
          {(["direct", "csv", "group"] as BulkMode[]).map((m) => {
            const count = m === "direct" ? directBatch.valid.length : m === "csv" ? csvBatch.valid.length : groupBatch.batch.valid.length;
            const Icon = m === "direct" ? Smartphone : m === "csv" ? FileSpreadsheet : Users;
            const label = m === "direct" ? "Direct Numbers" : m === "csv" ? "CSV / Excel" : "Phonebook Groups";
            return (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${mode === m ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"}`}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT: inputs + settings ──────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode 1: Direct numbers */}
            {mode === "direct" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-emerald-400" /> Paste Pakistani Mobile Numbers
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded accent-emerald-500" />
                    Remove Duplicates
                  </label>
                </div>
                <textarea rows={6} value={directNumbersRaw} onChange={(e) => setDirectNumbersRaw(e.target.value)}
                  placeholder="Paste Pakistani numbers (03xx, +923xx, one per line or comma-separated)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {directBatch.valid.length} Valid
                  </span>
                  {directBatch.duplicatesCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-500/30 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" /> {directBatch.duplicatesCount} Duplicates Filtered
                    </span>
                  )}
                  {directBatch.excluded.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-500/30 font-semibold">
                      <XCircle className="h-3.5 w-3.5" /> {directBatch.excluded.length} Invalid
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: CSV */}
            {mode === "csv" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> CSV / Excel Upload
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded accent-emerald-500" />
                    Remove Duplicates
                  </label>
                </div>
                <div onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                  onDragLeave={() => setIsDraggingCsv(false)} onDrop={handleCsvDrop}
                  onClick={() => csvFileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-xs cursor-pointer transition ${isDraggingCsv ? "border-emerald-500 bg-emerald-950/20 text-emerald-300" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                  <FileUp className="h-4 w-4" /> Drag & drop a .csv file here, or click to browse
                  <input ref={csvFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileInput} />
                </div>
                <textarea rows={5} value={csvRaw} onChange={(e) => setCsvRaw(e.target.value)}
                  placeholder={"phone,name,order_id\n03001234567,Ahmed,9021"}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                {csvHeaders.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Phone column</label>
                      <select value={phoneColumnOverride} onChange={(e) => setPhoneColumnOverride(e.target.value)}
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500">
                        <option value="">Auto-detect</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Name column</label>
                      <select value={nameColumnOverride} onChange={(e) => setNameColumnOverride(e.target.value)}
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500">
                        <option value="">Auto ("name")</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {csvHeaders.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {csvHeaders.map((h) => (
                      <button key={h} type="button" onClick={() => handleInsertTag(h)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold transition">
                        +{`{${h}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Groups */}
            {mode === "group" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-400" /> Select Contact Group
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button type="button" onClick={() => setSelectedGroup("")}
                    className={`p-3 rounded-xl border text-left transition ${selectedGroup === "" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"}`}>
                    <span className="font-bold text-xs block">All Contacts</span>
                    <span className="text-[10px] text-slate-500">{contacts.length} recipients</span>
                  </button>
                  {contactGroups.map((grp) => (
                    <button key={grp} type="button" onClick={() => setSelectedGroup(grp)}
                      className={`p-3 rounded-xl border text-left transition ${selectedGroup === grp ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"}`}>
                      <span className="font-bold text-xs block">{grp}</span>
                      <span className="text-[10px] text-slate-500">{contacts.filter((c) => c.group === grp).length} recipients</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Template */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Campaign SMS Template
                  {loadedTemplateName && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 normal-case tracking-normal">
                      📋 {loadedTemplateName}
                    </span>
                  )}
                </label>
                {templates.length > 0 && (
                  <select onChange={(e) => { const t = templates.find((tpl) => tpl.id === e.target.value); if (t) { setMessageTemplate(t.text); setLoadedTemplateName(t.name); } }}
                    className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-300 outline-none max-w-[220px]" defaultValue="">
                    <option value="" disabled>Load from Templates...</option>
                    {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                  </select>
                )}
              </div>
              <textarea rows={5} value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Enter SMS template with {name} or custom tags..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 leading-relaxed" />
              <label className="flex items-start gap-2 text-[11px] text-slate-400 cursor-pointer bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <input type="checkbox" checked={spintaxEnabled} onChange={(e) => setSpintaxEnabled(e.target.checked)} className="mt-0.5 rounded accent-emerald-500" />
                <span>
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Wand2 className="h-3 w-3 text-emerald-400" /> Enable spintax variation
                  </span>
                  Use <code className="text-emerald-400">{"{Hi|Salam|Hello}"}</code> — each recipient gets a random variant.
                </span>
              </label>
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Length: <strong className="text-white">{sampleAttrs.charCount}</strong> chars · <strong className="text-emerald-400">{sampleAttrs.segments}</strong> {sampleAttrs.segments === 1 ? "part" : "parts"}</span>
                <span className={sampleAttrs.hasUnicode ? "text-amber-400" : ""}>{sampleAttrs.encoding}</span>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-emerald-400" /> Dispatch & Telecom Safeguards
              </span>

              {delayMs < 3000 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-950/30 border border-amber-500/30 px-3 py-2.5 text-[11px] text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                  Delay below 3 s can trigger Android permission prompts and increase failures.
                  Recommended: <strong>5 s+</strong> for large campaigns.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Operator filter */}
                <div>
                  <label className="text-slate-400 block mb-1.5">Filter by Network:</label>
                  <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500">
                    <option value="all">All Networks</option>
                    <option value="Jazz">Jazz / Mobilink</option>
                    <option value="Zong">Zong</option>
                    <option value="Telenor">Telenor</option>
                    <option value="Ufone">Ufone</option>
                    <option value="SCOM">SCOM</option>
                  </select>
                </div>

                {/* Delay */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-400 flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-emerald-400" /> Delay Between SMS:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-400 tabular-nums">{(delayMs / 1000).toFixed(1)}s</span>
                      <span className="text-[10px] text-slate-500">~{Math.floor(60000 / (delayMs || 1))}/min</span>
                    </div>
                  </div>
                  <input type="range" min={2000} max={30000} step={500} value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-slate-800" />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5 px-0.5">
                    <span>2s</span><span>10s</span><span>20s</span><span>30s</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[3000, 5000, 7000, 10000, 15000, 30000].map((ms) => (
                      <button key={ms} type="button" onClick={() => setDelayMs(ms)}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition ${delayMs === ms ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"}`}>
                        {ms / 1000}s
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                    <input type="checkbox" checked={jitterEnabled} onChange={(e) => setJitterEnabled(e.target.checked)} className="rounded accent-emerald-500" />
                    <span className="text-[11px] text-slate-400">
                      <span className="text-slate-300 font-semibold">Jitter</span> ±30% randomisation
                      {jitterEnabled && <span className="text-slate-500 ml-1">({((delayMs * 0.7) / 1000).toFixed(1)}s–{((delayMs * 1.3) / 1000).toFixed(1)}s)</span>}
                    </span>
                  </label>
                </div>

                {/* Batch size */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-emerald-400" /> Batch Size:
                    </label>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">{batchSize}</span>
                  </div>
                  <input type="range" min={1} max={20} step={1} value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-slate-800" />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[1, 5, 10, 20].map((n) => (
                      <button key={n} type="button" onClick={() => setBatchSize(n)}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition ${batchSize === n ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"}`}>
                        {n === 1 ? "1 (safe)" : `×${n}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    {batchSize === 1 ? "One call per message — safest for personalised texts." : `Up to ${batchSize} same-text recipients per gateway call.`}
                  </p>
                </div>

                {/* SIM slot */}
                <div>
                  <label className="text-slate-400 block mb-1.5">SIM Card Slot:</label>
                  <input type="number" min={1} max={simSlotCount} value={selectedSim}
                    onChange={(e) => setSelectedSim(Math.min(simSlotCount, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500" />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {simSlotOptions.map((slot) => (
                      <button key={slot} type="button" onClick={() => setSelectedSim(slot)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${selectedSim === slot ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-950 border-slate-800 text-slate-500"}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Retries */}
                <div>
                  <label className="text-slate-400 mb-1.5 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-emerald-400" /> Failed Message Retry:
                  </label>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-[11px] text-slate-400 leading-relaxed">
                    <p className="text-slate-300 font-semibold mb-0.5">Manual retry after campaign ends</p>
                    Each message is attempted once. Any that fail are shown in the stream with the exact error.
                    After the campaign finishes, click <span className="text-amber-400 font-semibold">Retry Failed</span> to re-send only those messages — nothing else is re-sent.
                  </div>
                </div>
              </div>

              {/* Rate summary */}
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/60 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-emerald-500" />
                  ~{Math.floor(60000 / (delayMs || 1)) * batchSize} msg/min effective rate
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-emerald-500" />
                  Est. {preparedRows.length === 0 ? "—" : (() => {
                    const totalMs = Math.ceil(preparedRows.length / batchSize) * delayMs;
                    const m = Math.floor(totalMs / 60000);
                    const s = Math.floor((totalMs % 60000) / 1000);
                    return m > 0 ? `${m}m ${s}s` : `${s}s`;
                  })()} for {preparedRows.length} messages
                </span>
              </div>
            </div>

            {/* Opt-out */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldOff className="h-4 w-4 text-rose-400" /> Do-Not-Send / Opt-Out List
              </label>
              <textarea rows={3} value={optOutRaw} onChange={(e) => setOptOutRaw(e.target.value)}
                placeholder="Numbers that replied STOP — one per line or comma-separated..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-rose-500" />
              <p className="text-[11px] text-slate-500">{optOutSet.size} number(s) suppressed from all campaigns (saved in browser).</p>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-emerald-400" /> Schedule for Later
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="rounded accent-emerald-500" />
                  Enable Scheduling
                </label>
              </div>
              {isScheduled && (
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" />
              )}
              {scheduleState === "scheduled" && (
                <div className="flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                  <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />{countdownLabel || "Waiting to launch…"}</span>
                  <button type="button" onClick={handleCancelSchedule} className="font-bold hover:text-white">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: console ────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Audience summary + launch */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Target Audience</span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {preparedRows.length} Ready
                </span>
              </div>
              {suppressedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                  <ShieldOff className="h-3.5 w-3.5" /> {suppressedCount} suppressed (opt-out)
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.entries(activeStats.operatorStats) as [string, number][]).map(([op, count]) =>
                  count > 0 ? (
                    <div key={op} className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <OperatorBadge operator={op} size="sm" />
                      <span className="font-bold text-slate-300">{count}</span>
                    </div>
                  ) : null
                )}
              </div>

              {!isExecuting && scheduleState !== "scheduled" ? (
                <button type="button" onClick={handleStartCampaign} disabled={preparedRows.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {isScheduled ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {isScheduled ? "Schedule" : "Launch"} Campaign ({preparedRows.length} SMS)
                </button>
              ) : isExecuting ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={handlePauseResume}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs">
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button type="button" onClick={handleCancel}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs">
                      <XCircle className="h-4 w-4" /> Stop
                    </button>
                  </div>
                  {etaLabel && (
                    <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> {etaLabel}
                      {sendRateLabel && <span className="ml-2 text-emerald-400 font-mono">{sendRateLabel}</span>}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Progress */}
            {currentProgress.total > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-400" /> Campaign Progress
                  </span>
                  <span className="text-xs font-bold text-emerald-400">{pct}%</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                    style={{ width: `${pct}%` }} />
                  {/* failure overlay */}
                  {currentProgress.failed > 0 && (
                    <div className="absolute right-0 top-0 h-full bg-rose-500/40 transition-all duration-200"
                      style={{ width: `${(currentProgress.failed / currentProgress.total) * 100}%` }} />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Total</span>
                    <span className="font-bold text-white">{currentProgress.total}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Done</span>
                    <span className="font-bold text-slate-300">{currentProgress.completed}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-emerald-900/40">
                    <span className="text-[10px] text-emerald-400 block">Queued</span>
                    <span className="font-bold text-emerald-400">{currentProgress.success}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-rose-900/40">
                    <span className="text-[10px] text-rose-400 block">Failed</span>
                    <span className="font-bold text-rose-400">{currentProgress.failed}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {!isExecuting && currentProgress.failed > 0 && (
                    <button type="button" onClick={handleRetryFailed}
                      className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-white px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30 transition">
                      <RotateCcw className="h-3.5 w-3.5" /> Retry {currentProgress.failed} Failed
                    </button>
                  )}
                  <button type="button" onClick={handleExportReport}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition">
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>
              </div>
            )}

            {/* Live stream */}
            {processRows.length > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Dispatch Stream
                    <span className="ml-1.5 text-slate-500 font-normal normal-case">
                      (showing last {STREAM_WINDOW} of {processRows.length})
                    </span>
                  </span>
                  <button type="button" onClick={() => setStreamExpanded((v) => !v)}
                    className="text-slate-400 hover:text-white">
                    {streamExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                {streamExpanded && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input type="text" value={streamSearch} onChange={(e) => setStreamSearch(e.target.value)}
                          placeholder="Search phone or message..."
                          className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                      </div>
                      <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value as StreamFilter)}
                        className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500">
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="sending">Sending</option>
                        <option value="queued">Queued</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {filteredProcessRows.map((r, i) => (
                        <div key={`${r.phone}_${i}`}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{r.nationalPhone || r.phone}</span>
                              <OperatorBadge operator={r.operator} size="sm" />
                              {(r.attempts ?? 0) > 1 && <span className="text-[10px] text-amber-400">×{r.attempts}</span>}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{r.text}</p>
                            {r.error && <p className="text-[10px] text-rose-400 truncate max-w-[220px]">{r.error}</p>}
                          </div>
                          <div className="shrink-0"><StatusBadge status={r.status} size="sm" /></div>
                        </div>
                      ))}
                      {filteredProcessRows.length === 0 && (
                        <p className="text-center text-xs text-slate-500 py-4">No rows match filters.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Sticky execution bar (visible on all pages while running) ──── */}
      {isExecuting && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-900/95 backdrop-blur-md px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center gap-4">
            <Zap className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-semibold text-white truncate">{campaignTitle}</span>
                <span className="text-emerald-400 font-mono font-bold tabular-nums ml-2 shrink-0">
                  {currentProgress.completed}/{currentProgress.total} · {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {etaLabel && <span className="text-slate-400 hidden sm:block">{etaLabel}</span>}
              {sendRateLabel && <span className="text-emerald-400 font-mono hidden sm:block">{sendRateLabel}</span>}
              <button type="button" onClick={handlePauseResume}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold">
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BulkSmsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading campaign engine…</div>
      </div>
    }>
      <BulkSmsInner />
    </Suspense>
  );
}
