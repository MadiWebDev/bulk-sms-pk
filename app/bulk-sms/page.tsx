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
import { CampaignRecord } from "@/lib/types";
import {
  Send,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
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
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DRAFTS_STORAGE_KEY = "bulk_sms_drafts_v2";
const OPTOUT_STORAGE_KEY = "bulk_sms_optout_v1";
/** localStorage key that persists the active server campaign ID across reloads */
const ACTIVE_CAMPAIGN_KEY = "bulk_sms_active_campaign_v1";
/** How often the UI polls the server for progress (ms) */
const POLL_INTERVAL = 3000;
/** Max rows shown in the live stream */
const STREAM_WINDOW = 150;

// ─── Types ────────────────────────────────────────────────────────────────────
type BulkMode = "direct" | "csv" | "group";
type ScheduleState = "idle" | "scheduled" | "running";
type StreamFilter = "all" | "pending" | "queued" | "failed" | "delivered";

interface ProcessRow {
  index: number;
  phone: string;
  nationalPhone?: string;
  operator?: PakistanOperator;
  text: string;
  status: "pending" | "sending" | "queued" | "failed" | "delivered";
  error?: string;
  gatewayId?: string;
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

/** Progress shape returned by GET /api/campaigns/run */
interface ServerProgress {
  campaignId: string;
  campaignTitle: string;
  status: "running" | "completed" | "cancelled" | "cancelling" | "failed";
  totalMessages: number;
  sentCount: number;
  failedCount: number;
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
function BulkSmsInner() {
  const {
    gatewayConfig,
    contacts,
    contactGroups,
    templates,
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

  // ── Inputs ──────────────────────────────────────────────────────────────────
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
  const [delayMs, setDelayMs] = useState<number>(10000);
  const [jitterEnabled, setJitterEnabled] = useState<boolean>(true);
  const [batchSize, setBatchSize] = useState<number>(1);
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [deduplicate, setDeduplicate] = useState<boolean>(true);

  // ── Opt-out list ────────────────────────────────────────────────────────────
  const [optOutRaw, setOptOutRaw] = useState<string>("");
  useEffect(() => {
    try { const s = localStorage.getItem(OPTOUT_STORAGE_KEY); if (s) setOptOutRaw(s); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(OPTOUT_STORAGE_KEY, optOutRaw); } catch {}
  }, [optOutRaw]);
  const optOutSet = useMemo(() => {
    const set = new Set<string>();
    optOutRaw.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((l) => {
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

  // ── Server campaign state ───────────────────────────────────────────────────
  /** The campaignId currently running on the server (persisted to localStorage) */
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_CAMPAIGN_KEY); } catch { return null; }
  });
  const [serverProgress, setServerProgress] = useState<ServerProgress | null>(null);
  /** Full prepared rows — kept in state so the stream works after reload */
  const [preparedRowsSnapshot, setPreparedRowsSnapshot] = useState<ProcessRow[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Set to true to abort the client-side burst continuation loop */
  const abortBurstRef = useRef<boolean>(false);
  /** AbortController for the currently in-flight burst fetch — aborted on Stop */
  const burstAbortControllerRef = useRef<AbortController | null>(null);

  // ── Stream UI ───────────────────────────────────────────────────────────────
  const [streamSearch, setStreamSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");
  const [streamExpanded, setStreamExpanded] = useState(true);

  // ── Drafts ──────────────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  useEffect(() => {
    try { const r = localStorage.getItem(DRAFTS_STORAGE_KEY); if (r) setDrafts(JSON.parse(r)); } catch {}
  }, []);
  const persistDrafts = (next: CampaignDraft[]) => {
    setDrafts(next);
    try { localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // ── Parsing ─────────────────────────────────────────────────────────────────
  const directBatch = useMemo(() => {
    const rawLines = directNumbersRaw.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
    return validatePakistanPhoneBatch(rawLines, deduplicate);
  }, [directNumbersRaw, deduplicate]);

  const { csvHeaders, csvRows, csvBatch } = useMemo(() => {
    const lines = csvRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { csvHeaders: [], csvRows: [], csvBatch: { valid: [], excluded: [], duplicatesCount: 0, operatorStats: {} as Record<string, number> } };
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const autoPhoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("num"));
    const phoneColIdx = phoneColumnOverride && headers.includes(phoneColumnOverride) ? headers.indexOf(phoneColumnOverride) : autoPhoneIdx;
    const activePhoneIdx = phoneColIdx !== -1 ? phoneColIdx : 0;
    const parsedRows: Array<{ phone: string; [k: string]: string }> = [];
    const phoneInputs: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      const rawPhone = parts[activePhoneIdx] || "";
      const rowObj: { phone: string; [k: string]: string } = { phone: rawPhone };
      headers.forEach((h, idx) => { rowObj[h] = parts[idx] || ""; });
      if (nameColumnOverride && headers.includes(nameColumnOverride)) rowObj.name = parts[headers.indexOf(nameColumnOverride)] || rowObj.name || "";
      parsedRows.push(rowObj);
      phoneInputs.push(rawPhone);
    }
    return { csvHeaders: headers, csvRows: parsedRows, csvBatch: validatePakistanPhoneBatch(phoneInputs, deduplicate) };
  }, [csvRaw, deduplicate, phoneColumnOverride, nameColumnOverride]);

  const groupBatch = useMemo(() => {
    const filtered = selectedGroup ? contacts.filter((c) => c.group === selectedGroup) : contacts;
    return { contacts: filtered, batch: validatePakistanPhoneBatch(filtered.map((c) => c.phone), deduplicate) };
  }, [contacts, selectedGroup, deduplicate]);

  const activeStats = useMemo(() => {
    if (mode === "direct") return directBatch;
    if (mode === "csv") return csvBatch;
    return groupBatch.batch;
  }, [mode, directBatch, csvBatch, groupBatch]);

  const resolveSpintax = useCallback((text: string): string =>
    text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, g: string) => {
      const opts = g.split("|"); return opts[Math.floor(Math.random() * opts.length)];
    }), []);

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
        push(val.e164 || "", { index: idx, phone: val.e164 || "", nationalPhone: val.national, operator: val.operator, text: buildText({ name: "Customer", phone: val.national || val.e164, operator: val.operator }) });
      });
    } else if (mode === "csv") {
      csvRows.forEach((row, idx) => {
        const val = validatePakistanPhone(row.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        push(val.e164, { index: idx, phone: val.e164, nationalPhone: val.national, operator: val.operator, text: buildText({ ...row, operator: val.operator }) });
      });
    } else {
      groupBatch.contacts.forEach((contact, idx) => {
        const val = validatePakistanPhone(contact.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        push(val.e164, { index: idx, phone: val.e164, nationalPhone: val.national, operator: val.operator, text: buildText({ name: contact.name, phone: contact.nationalPhone || contact.phone, operator: contact.operator, group: contact.group }) });
      });
    }
    return { preparedRows: rows, suppressedCount: suppressed };
  }, [mode, directBatch, csvRows, groupBatch, filterOperator, messageTemplate, spintaxEnabled, resolveSpintax, optOutSet]);

  const sampleAttrs = useMemo(() => calculateSMSAttributes(messageTemplate), [messageTemplate]);

  // ── Server polling ──────────────────────────────────────────────────────────
  /**
   * Polls the server for campaign progress.
   * Also acts as the "reconnect" path: if the user reloads the page while a
   * campaign is running (no burst loop active), polling drives the UI updates
   * and saves the completed campaign to history.
   */
  const pollProgress = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`/api/campaigns/run?campaignId=${encodeURIComponent(cid)}`);
      if (!res.ok) return;
      const data: ServerProgress = await res.json();
      setServerProgress(data);

      // When done, store campaign record and clear active id
      if (data.status === "completed" || data.status === "cancelled") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
        setActiveCampaignId(null);

        if (data.status === "completed") {
          const rec: CampaignRecord = {
            id: cid,
            title: data.campaignTitle,
            createdAt: data.startedAt,
            totalRecipients: data.totalMessages,
            sentCount: data.sentCount,
            failedCount: data.failedCount,
            operatorStats: {},
            status: "completed",
            textTemplate: messageTemplate,
            simNumber: selectedSim,
          };
          addCampaign(rec);
          // Only show toast here if the burst loop is NOT active
          // (i.e., user reloaded the page and is only polling)
          if (abortBurstRef.current === false && !isLaunching) {
            showToast(
              data.failedCount === 0 ? "success" : "warning",
              `Campaign done: ${data.sentCount} sent${data.failedCount > 0 ? `, ${data.failedCount} failed` : ""}.`,
              "Campaign Finished"
            );
          }
        }
      }
    } catch {}
  }, [messageTemplate, selectedSim, addCampaign, showToast, isLaunching]);

  // Start polling when activeCampaignId is set
  useEffect(() => {
    if (!activeCampaignId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    // Immediate first poll
    pollProgress(activeCampaignId);
    pollRef.current = setInterval(() => pollProgress(activeCampaignId), POLL_INTERVAL);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [activeCampaignId, pollProgress]);

  // ── Derived state from server progress ─────────────────────────────────────
  const isRunning = serverProgress?.status === "running" || serverProgress?.status === "cancelling";
  const pct = serverProgress && serverProgress.totalMessages > 0
    ? Math.round((serverProgress.currentIndex / serverProgress.totalMessages) * 100)
    : 0;

  /**
   * Build a visual row list from the snapshot + server progress.
   * Rows up to currentIndex get their status from which bucket they fell in.
   */
  const displayRows = useMemo((): ProcessRow[] => {
    if (!serverProgress || preparedRowsSnapshot.length === 0) return [];
    const { currentIndex, totalMessages } = serverProgress;
    return preparedRowsSnapshot.map((r, i) => {
      if (i < currentIndex) {
        // Approximate: we don't track per-row failures in the poll response.
        // Mark as queued. Failed messages are visible in /history.
        return { ...r, status: "queued" as const };
      }
      if (i === currentIndex && isRunning) return { ...r, status: "sending" as const };
      return { ...r, status: "pending" as const };
    }).slice(Math.max(0, currentIndex - STREAM_WINDOW), currentIndex + 10);
  }, [serverProgress, preparedRowsSnapshot, isRunning]);

  const filteredDisplayRows = useMemo(() => {
    let rows = displayRows;
    if (streamFilter !== "all") rows = rows.filter((r) => r.status === streamFilter);
    if (streamSearch.trim()) {
      const q = streamSearch.trim().toLowerCase();
      rows = rows.filter((r) => `${r.phone} ${r.nationalPhone || ""} ${r.text}`.toLowerCase().includes(q));
    }
    return rows.slice(-STREAM_WINDOW);
  }, [displayRows, streamFilter, streamSearch]);

  // ── Launch campaign ─────────────────────────────────────────────────────────
  const launchCampaign = useCallback(async (rows: ProcessRow[]) => {
    if (!gatewayConfig.username || !gatewayConfig.password) {
      showToast("danger", "Gateway credentials are not configured. Go to Connection settings first.", "No Credentials");
      return;
    }

    setIsLaunching(true);
    abortBurstRef.current = false;
    const campaignId = `cmp_${Date.now()}`;

    const messages = rows.map((r) => ({
      phone: r.phone,
      nationalPhone: r.nationalPhone,
      operator: r.operator,
      text: r.text,
      rowIndex: r.index,
    }));

    const buildBody = (resumeFrom: number) => ({
      campaignId,
      campaignTitle,
      gatewayUsername: activeGatewayUsername || gatewayConfig.username,
      messages,
      resumeFrom,
      config: {
        username: gatewayConfig.username,
        password: gatewayConfig.password,
        baseUrl: gatewayConfig.baseUrl,
        deviceId: gatewayConfig.deviceId,
        simNumber: selectedSim,
        delayMs,
        jitterEnabled,
        batchSize,
      },
    });

    // Set up optimistic UI state before first burst
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, campaignId);
    setActiveCampaignId(campaignId);
    setPreparedRowsSnapshot(rows);
    setServerProgress({
      campaignId,
      campaignTitle,
      status: "running",
      totalMessages: rows.length,
      sentCount: 0,
      failedCount: 0,
      currentIndex: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ── Burst continuation loop ────────────────────────────────────────────────
    // Each POST call processes messages for up to 8 s (BURST_TIMEOUT_MS on server),
    // then returns { done, currentIndex }. We immediately re-POST until done.
    // burstAbortControllerRef holds the AbortController for the current fetch so
    // handleCancelServerCampaign can abort it instantly without waiting 8 s.
    let resumeFrom = 0;
    let launched = false;
    try {
      while (!abortBurstRef.current) {
        // Create a fresh AbortController for this fetch
        const ac = new AbortController();
        burstAbortControllerRef.current = ac;

        let res: Response;
        try {
          res = await fetch("/api/campaigns/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildBody(resumeFrom)),
            signal: ac.signal,
          });
        } catch (fetchErr) {
          // fetch was aborted by Stop button — clean exit
          if ((fetchErr as Error)?.name === "AbortError") break;
          throw fetchErr;
        } finally {
          burstAbortControllerRef.current = null;
        }

        // Check abort flag again after the fetch resolved
        if (abortBurstRef.current) break;

        const data = await res.json();

        // Check abort flag after json parse too
        if (abortBurstRef.current) break;

        if (!res.ok || !data.ok) {
          if (!launched) {
            // First call failed — show error and bail
            showToast("danger", data.error || "Failed to start campaign on server.", "Launch Failed");
            localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
            setActiveCampaignId(null);
            setServerProgress(null);
          } else {
            // Mid-campaign failure — log it but let polling handle status
            console.error("[burst] POST error mid-campaign:", data.error);
          }
          break;
        }

        if (!launched) {
          launched = true;
          showToast("success", `Campaign started — ${rows.length} messages queued. Processing now…`, "Running");
          setIsLaunching(false);
        }

        // Update optimistic progress from the response
        setServerProgress((prev) =>
          prev
            ? {
                ...prev,
                currentIndex: data.currentIndex ?? prev.currentIndex,
                sentCount: data.sentCount ?? prev.sentCount,
                failedCount: data.failedCount ?? prev.failedCount,
                status: data.done ? (data.cancelled ? "cancelled" : "completed") : "running",
              }
            : prev
        );

        if (data.done || data.cancelled) {
          // Campaign finished naturally or was cancelled
          localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
          setActiveCampaignId(null);
          if (!data.cancelled) {
            showToast(
              data.failedCount === 0 ? "success" : "warning",
              `Campaign done: ${data.sentCount} sent${data.failedCount > 0 ? `, ${data.failedCount} failed` : ""}.`,
              "Campaign Finished"
            );
          } else {
            showToast("warning", "Campaign was cancelled.", "Cancelled");
          }
          break;
        }

        // Not done yet — advance resumeFrom and send next burst
        resumeFrom = data.currentIndex ?? resumeFrom;
      }
    } catch (err) {
      if (!launched) {
        showToast("danger", err instanceof Error ? err.message : "Network error", "Launch Failed");
        localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
        setActiveCampaignId(null);
        setServerProgress(null);
      } else {
        // Mid-campaign network error — polling will detect the stall
        console.error("[burst] Network error mid-campaign:", err);
      }
    } finally {
      burstAbortControllerRef.current = null;
      setIsLaunching(false);
    }
  }, [gatewayConfig, activeGatewayUsername, campaignTitle, selectedSim, delayMs, jitterEnabled, batchSize, showToast]);

  const handleStartCampaign = () => {
    if (preparedRows.length === 0) {
      showToast("warning", "No valid recipients match the current filter.", "Empty Campaign");
      return;
    }
    if (isScheduled && scheduledAt) {
      const targetTime = new Date(scheduledAt).getTime();
      const msUntil = targetTime - Date.now();
      if (msUntil <= 0) { showToast("warning", "Scheduled time must be in the future.", "Invalid Schedule"); return; }
      setScheduleState("scheduled");
      scheduleTimeoutRef.current = setTimeout(() => { setScheduleState("running"); launchCampaign(preparedRows); }, msUntil);
      countdownIntervalRef.current = setInterval(() => {
        const msLeft = targetTime - Date.now();
        if (msLeft <= 0) { setCountdownLabel("Starting now…"); if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); return; }
        const h = Math.floor(msLeft / 3600000), m = Math.floor((msLeft % 3600000) / 60000), s = Math.floor((msLeft % 60000) / 1000);
        setCountdownLabel(`${h > 0 ? `${h}h ` : ""}${m}m ${s}s until launch`);
      }, 1000);
      showToast("info", `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}.`, "Scheduled");
      return;
    }
    launchCampaign(preparedRows);
  };

  const handleCancelSchedule = () => {
    if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setScheduleState("idle"); setCountdownLabel("");
    showToast("info", "Schedule cancelled.", "Cancelled");
  };

  const handleCancelServerCampaign = async () => {
    if (!activeCampaignId) return;

    // 1. Stop the client burst loop flag
    abortBurstRef.current = true;

    // 2. Abort any in-flight fetch immediately — don't wait 8 s for it to finish
    burstAbortControllerRef.current?.abort();
    burstAbortControllerRef.current = null;

    // 3. Immediately reflect "stopping" in the UI
    setServerProgress((prev) =>
      prev ? { ...prev, status: "cancelling" } : prev
    );
    setActiveCampaignId(null);
    localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);

    // 4. Tell the server to mark the campaign as cancelling in MongoDB
    //    (so any server-side burst that's mid-run also stops)
    try {
      await fetch(`/api/campaigns/run?campaignId=${encodeURIComponent(activeCampaignId)}`, { method: "DELETE" });
      showToast("warning", "Campaign stopped.", "Stopped");
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportReport = () => {
    if (preparedRowsSnapshot.length === 0) return;
    const header = "Phone,National,Operator,Status,Message\n";
    const body = preparedRowsSnapshot.map((r) =>
      `"${r.phone}","${r.nationalPhone || ""}","${r.operator || ""}","${r.status}","${r.text.replace(/"/g, '""')}"`
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.setAttribute("download", `sms_campaign_report_${Date.now()}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleInsertTag = (tag: string) => setMessageTemplate((prev) => `${prev} {${tag}}`);

  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setCsvRaw(String(reader.result || "").trim()); setPhoneColumnOverride(""); setNameColumnOverride(""); showToast("success", `Loaded ${file.name}.`, "File Loaded"); };
    reader.onerror = () => showToast("error", "Could not read that file.", "Upload Failed");
    reader.readAsText(file);
  };
  const handleCsvFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) readCsvFile(f); e.target.value = ""; };
  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingCsv(false); const f = e.dataTransfer.files?.[0]; if (f) readCsvFile(f); };

  const handleSaveDraft = () => {
    const name = campaignTitle || `Draft ${drafts.length + 1}`;
    const draft: CampaignDraft = { id: `draft_${Date.now()}`, name, savedAt: new Date().toISOString(), mode, directNumbersRaw, csvRaw, messageTemplate, campaignTitle, filterOperator, delayMs, jitterEnabled, batchSize, selectedSim };
    persistDrafts([draft, ...drafts].slice(0, 20));
    showToast("success", `Saved draft "${name}".`, "Draft Saved");
  };
  const handleLoadDraft = (draft: CampaignDraft) => {
    setMode(draft.mode); setDirectNumbersRaw(draft.directNumbersRaw); setCsvRaw(draft.csvRaw);
    setMessageTemplate(draft.messageTemplate); setCampaignTitle(draft.campaignTitle);
    setFilterOperator(draft.filterOperator); setDelayMs(draft.delayMs);
    setJitterEnabled(draft.jitterEnabled ?? true); setBatchSize(draft.batchSize ?? 1); setSelectedSim(draft.selectedSim);
    showToast("info", `Loaded draft "${draft.name}".`, "Draft Loaded");
  };

  const simSlotOptions = useMemo(() => Array.from({ length: Math.max(1, Math.min(simSlotCount, 12)) }, (_, i) => i + 1), [simSlotCount]);

  const etaLabel = useMemo(() => {
    if (!serverProgress || !isRunning) return "";
    const remaining = serverProgress.totalMessages - serverProgress.currentIndex;
    if (remaining <= 0) return "";
    const elapsed = Date.now() - new Date(serverProgress.startedAt).getTime();
    const done = serverProgress.currentIndex;
    if (done === 0) return "";
    const perMs = elapsed / done;
    const remMs = Math.round(perMs * remaining);
    const m = Math.floor(remMs / 60000), s = Math.floor(remMs / 1000) % 60;
    return `~${m}m ${s}s left`;
  }, [serverProgress, isRunning]);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050810] text-[#e6edf3] pb-32">
      {/* Header */}
      <div className="border-b border-[#21262d] bg-[#0d1117] py-5 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Send className="h-3 w-3" /> Bulk Campaign Dispatcher
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  <Activity className="h-3 w-3" />
                  Running on server — {pct}% ({serverProgress?.currentIndex}/{serverProgress?.totalMessages})
                </span>
              )}
              {serverProgress?.status === "completed" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Personalized Bulk SMS Engine</h1>
            <p className="text-xs text-[#7d8590] mt-0.5">
              Campaigns run entirely on the server — close this tab, refresh, navigate freely. Nothing stops.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSaveDraft} className="flex items-center gap-1.5 rounded-xl border border-[#21262d] bg-[#161b22] px-3 py-1.5 text-xs font-semibold text-[#c9d1d9] hover:text-white transition">
              <Save className="h-3.5 w-3.5" /> Save Draft
            </button>
            <input type="text" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)}
              className="rounded-xl border border-[#21262d] bg-[#161b22] px-3 py-1.5 text-xs text-white placeholder-[#484f58] outline-none focus:border-[#238636]"
              placeholder="Campaign Title..." />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Server status banner */}
        {activeCampaignId && serverProgress && (
          <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isRunning ? "border-emerald-500/30 bg-emerald-950/20" : "border-[#30363d] bg-[#0d1117]"
          }`}>
            <div className="flex items-center gap-3">
              {isRunning ? <Wifi className="h-5 w-5 text-emerald-400 shrink-0" /> : <WifiOff className="h-5 w-5 text-[#484f58] shrink-0" />}
              <div>
                <p className="text-sm font-bold text-white">{serverProgress.campaignTitle}</p>
                <p className="text-xs text-[#7d8590] mt-0.5">
                  {serverProgress.sentCount} sent · {serverProgress.failedCount} failed · {serverProgress.totalMessages - serverProgress.currentIndex} remaining
                  {etaLabel && <span className="ml-2 text-emerald-400">{etaLabel}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isRunning && (
                <button type="button" onClick={handleCancelServerCampaign}
                  className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold transition flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" /> Stop Campaign
                </button>
              )}
              <button type="button" onClick={handleExportReport}
                className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#21262d] text-[#c9d1d9] text-xs font-semibold transition flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>
        )}

        {/* Progress panel */}
        {serverProgress && (
          <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-emerald-400" /> Campaign Progress
                <span className="text-[#484f58] font-normal normal-case ml-1">— server-side, survives page refresh</span>
              </span>
              <span className="text-xs font-bold text-emerald-400">{pct}%</span>
            </div>
            <div className="w-full h-3 bg-[#050810] rounded-full overflow-hidden border border-[#21262d] relative">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: "Total", val: serverProgress.totalMessages, color: "text-white" },
                { label: "Done", val: serverProgress.currentIndex, color: "text-[#c9d1d9]" },
                { label: "Queued", val: serverProgress.sentCount, color: "text-emerald-400" },
                { label: "Failed", val: serverProgress.failedCount, color: "text-rose-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-2 rounded-xl bg-[#050810] border border-[#21262d]">
                  <span className="text-[10px] text-[#484f58] block">{label}</span>
                  <span className={`font-bold tabular-nums ${color}`}>{val}</span>
                </div>
              ))}
            </div>
            {serverProgress.status === "running" && (
              <p className="text-[11px] text-[#484f58] text-center flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-refreshing every {POLL_INTERVAL / 1000}s — you can navigate away safely
              </p>
            )}
          </div>
        )}

        {/* Live stream */}
        {preparedRowsSnapshot.length > 0 && serverProgress && (
          <div className="rounded-xl border border-[#21262d]/80 bg-[#0d1117] backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#21262d]">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Dispatch Stream
                <span className="ml-1.5 text-[#484f58] font-normal normal-case">(last {STREAM_WINDOW} processed rows)</span>
              </span>
              <button type="button" onClick={() => setStreamExpanded((v) => !v)} className="text-[#7d8590] hover:text-white">
                {streamExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {streamExpanded && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 text-[#484f58] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={streamSearch} onChange={(e) => setStreamSearch(e.target.value)}
                      placeholder="Search phone or message..."
                      className="w-full rounded-lg bg-[#050810] border border-[#21262d] pl-8 pr-2 py-1.5 text-xs text-white placeholder-[#484f58] outline-none focus:border-[#238636]" />
                  </div>
                  <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value as StreamFilter)}
                    className="rounded-lg bg-[#050810] border border-[#21262d] px-2 py-1.5 text-xs text-white outline-none">
                    <option value="all">All</option>
                    <option value="queued">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {filteredDisplayRows.map((r, i) => (
                    <div key={`${r.phone}_${i}`} className="p-2.5 rounded-xl bg-[#161b22] border border-[#21262d] text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{r.nationalPhone || r.phone}</span>
                          <OperatorBadge operator={r.operator} size="sm" />
                        </div>
                        <p className="text-[11px] text-[#7d8590] truncate max-w-[220px]">{r.text}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === "queued" ? "bg-emerald-500/15 text-emerald-400" :
                        r.status === "failed" ? "bg-rose-500/15 text-rose-400" :
                        r.status === "sending" ? "bg-amber-500/15 text-amber-400" :
                        "bg-[#21262d] text-[#7d8590]"
                      }`}>{r.status}</span>
                    </div>
                  ))}
                  {filteredDisplayRows.length === 0 && <p className="text-center text-xs text-[#484f58] py-4">No rows match filters.</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drafts */}
        {drafts.length > 0 && (
          <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-3 flex items-center gap-2 overflow-x-auto">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#7d8590] uppercase tracking-wider shrink-0">
              <FolderOpen className="h-3.5 w-3.5" /> Drafts
            </span>
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-1.5 shrink-0 rounded-lg bg-[#050810] border border-[#21262d] px-2.5 py-1">
                <button type="button" onClick={() => handleLoadDraft(d)} className="text-xs text-[#c9d1d9] hover:text-emerald-400 font-medium">{d.name}</button>
                <button type="button" onClick={() => persistDrafts(drafts.filter((x) => x.id !== d.id))} className="text-[#30363d] hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex items-center gap-2 border-b border-[#21262d] pb-3 overflow-x-auto">
          {(["direct", "csv", "group"] as BulkMode[]).map((m) => {
            const count = m === "direct" ? directBatch.valid.length : m === "csv" ? csvBatch.valid.length : groupBatch.batch.valid.length;
            const Icon = m === "direct" ? Smartphone : m === "csv" ? FileSpreadsheet : Users;
            const label = m === "direct" ? "Direct Numbers" : m === "csv" ? "CSV / Excel" : "Phonebook Groups";
            return (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${mode === m ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-[#161b22] text-[#7d8590] hover:text-white border border-[#21262d]"}`}>
                <Icon className="h-4 w-4" /><span>{label}</span>
                <span className="ml-1 rounded-full bg-[#21262d] px-2 py-0.5 text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: inputs + settings */}
          <div className="lg:col-span-7 space-y-6">
            {mode === "direct" && (
              <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-emerald-400" /> Paste Pakistani Mobile Numbers</label>
                  <label className="flex items-center gap-1.5 text-xs text-[#7d8590] cursor-pointer">
                    <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded accent-emerald-500" /> Remove Duplicates
                  </label>
                </div>
                <textarea rows={6} value={directNumbersRaw} onChange={(e) => setDirectNumbersRaw(e.target.value)}
                  placeholder="Paste Pakistani numbers (03xx, +923xx, one per line or comma-separated)..."
                  className="w-full rounded-xl border border-[#21262d] bg-[#161b22] p-3 text-xs font-mono text-white placeholder-[#484f58] outline-none focus:border-[#238636]" />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> {directBatch.valid.length} Valid</span>
                  {directBatch.duplicatesCount > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-500/30 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> {directBatch.duplicatesCount} Duplicates</span>}
                  {directBatch.excluded.length > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-500/30 font-semibold"><XCircle className="h-3.5 w-3.5" /> {directBatch.excluded.length} Invalid</span>}
                </div>
              </div>
            )}

            {mode === "csv" && (
              <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-emerald-400" /> CSV / Excel Upload</label>
                  <label className="flex items-center gap-1.5 text-xs text-[#7d8590] cursor-pointer">
                    <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded accent-emerald-500" /> Remove Duplicates
                  </label>
                </div>
                <div onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }} onDragLeave={() => setIsDraggingCsv(false)} onDrop={handleCsvDrop}
                  onClick={() => csvFileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-xs cursor-pointer transition ${isDraggingCsv ? "border-emerald-500 bg-emerald-950/20 text-emerald-300" : "border-[#30363d] text-[#7d8590] hover:border-[#30363d]"}`}>
                  <FileUp className="h-4 w-4" /> Drag & drop a .csv file, or click to browse
                  <input ref={csvFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileInput} />
                </div>
                <textarea rows={5} value={csvRaw} onChange={(e) => setCsvRaw(e.target.value)}
                  placeholder={"phone,name,order_id\n03001234567,Ahmed,9021"}
                  className="w-full rounded-xl border border-[#21262d] bg-[#161b22] p-3 text-xs font-mono text-white placeholder-[#484f58] outline-none focus:border-[#238636]" />
                {csvHeaders.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#7d8590] block mb-1">Phone column</label>
                      <select value={phoneColumnOverride} onChange={(e) => setPhoneColumnOverride(e.target.value)} className="w-full rounded-lg bg-[#050810] border border-[#21262d] px-2 py-1.5 text-xs text-white outline-none focus:border-[#238636]">
                        <option value="">Auto-detect</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#7d8590] block mb-1">Name column</label>
                      <select value={nameColumnOverride} onChange={(e) => setNameColumnOverride(e.target.value)} className="w-full rounded-lg bg-[#050810] border border-[#21262d] px-2 py-1.5 text-xs text-white outline-none focus:border-[#238636]">
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

            {mode === "group" && (
              <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Users className="h-4 w-4 text-emerald-400" /> Select Contact Group</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button type="button" onClick={() => setSelectedGroup("")}
                    className={`p-3 rounded-xl border text-left transition ${selectedGroup === "" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-[#050810] border-[#21262d] text-[#7d8590] hover:text-white"}`}>
                    <span className="font-bold text-xs block">All Contacts</span>
                    <span className="text-[10px] text-[#484f58]">{contacts.length} recipients</span>
                  </button>
                  {contactGroups.map((grp) => (
                    <button key={grp} type="button" onClick={() => setSelectedGroup(grp)}
                      className={`p-3 rounded-xl border text-left transition ${selectedGroup === grp ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-[#050810] border-[#21262d] text-[#7d8590] hover:text-white"}`}>
                      <span className="font-bold text-xs block">{grp}</span>
                      <span className="text-[10px] text-[#484f58]">{contacts.filter((c) => c.group === grp).length} recipients</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message template */}
            <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Campaign SMS Template
                  {loadedTemplateName && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 normal-case">📋 {loadedTemplateName}</span>}
                </label>
                {templates.length > 0 && (
                  <select onChange={(e) => { const t = templates.find((tpl) => tpl.id === e.target.value); if (t) { setMessageTemplate(t.text); setLoadedTemplateName(t.name); } }}
                    className="rounded-lg bg-[#21262d] border border-[#30363d] px-2 py-1 text-xs text-[#c9d1d9] outline-none max-w-[220px]" defaultValue="">
                    <option value="" disabled>Load from Templates...</option>
                    {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                  </select>
                )}
              </div>
              <textarea rows={5} value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Enter SMS template with {name} or custom tags..."
                className="w-full rounded-xl border border-[#21262d] bg-[#161b22] p-3.5 text-xs text-white placeholder-[#484f58] outline-none focus:border-[#238636] leading-relaxed" />
              <label className="flex items-start gap-2 text-[11px] text-[#7d8590] cursor-pointer bg-[#161b22] border border-[#21262d] rounded-lg p-2.5">
                <input type="checkbox" checked={spintaxEnabled} onChange={(e) => setSpintaxEnabled(e.target.checked)} className="mt-0.5 rounded accent-emerald-500" />
                <span><span className="flex items-center gap-1 text-[#c9d1d9] font-semibold"><Wand2 className="h-3 w-3 text-emerald-400" /> Enable spintax</span>
                Use <code className="text-emerald-400">{"{Hi|Salam|Hello}"}</code> — each recipient gets a random variant.</span>
              </label>
              <div className="flex items-center justify-between text-xs text-[#7d8590] px-1">
                <span>Length: <strong className="text-white">{sampleAttrs.charCount}</strong> chars · <strong className="text-emerald-400">{sampleAttrs.segments}</strong> {sampleAttrs.segments === 1 ? "part" : "parts"}</span>
                <span className={sampleAttrs.hasUnicode ? "text-amber-400" : ""}>{sampleAttrs.encoding}</span>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Sliders className="h-4 w-4 text-emerald-400" /> Dispatch & Telecom Safeguards</span>
              {delayMs < 5000 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-950/30 border border-amber-500/30 px-3 py-2.5 text-[11px] text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                  Delay below 5 s risks Android permission prompts. Recommended: <strong>10 s+</strong> for large campaigns.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#7d8590] block mb-1.5">Filter by Network:</label>
                  <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}
                    className="w-full rounded-xl bg-[#050810] border border-[#21262d] px-3 py-2 text-white outline-none focus:border-[#238636]">
                    <option value="all">All Networks</option>
                    <option value="Jazz">Jazz / Mobilink</option>
                    <option value="Zong">Zong</option>
                    <option value="Telenor">Telenor</option>
                    <option value="Ufone">Ufone</option>
                    <option value="SCOM">SCOM</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[#7d8590] flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-emerald-400" /> Delay Between SMS:</label>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">{(delayMs / 1000).toFixed(0)}s</span>
                  </div>
                  <input type="range" min={2000} max={30000} step={1000} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-[#21262d]" />
                  <div className="flex justify-between text-[10px] text-[#30363d] mt-0.5 px-0.5"><span>2s</span><span>10s</span><span>20s</span><span>30s</span></div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[5000, 7000, 10000, 15000, 20000, 30000].map((ms) => (
                      <button key={ms} type="button" onClick={() => setDelayMs(ms)}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition ${delayMs === ms ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-[#050810] border-[#21262d] text-[#7d8590] hover:text-white"}`}>
                        {ms / 1000}s
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                    <input type="checkbox" checked={jitterEnabled} onChange={(e) => setJitterEnabled(e.target.checked)} className="rounded accent-emerald-500" />
                    <span className="text-[11px] text-[#7d8590]"><span className="text-[#c9d1d9] font-semibold">Jitter</span> ±30% randomisation
                      {jitterEnabled && <span className="text-[#484f58] ml-1">({((delayMs * 0.7) / 1000).toFixed(1)}s–{((delayMs * 1.3) / 1000).toFixed(1)}s)</span>}
                    </span>
                  </label>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[#7d8590] flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-emerald-400" /> Batch Size:</label>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">{batchSize}</span>
                  </div>
                  <input type="range" min={1} max={20} step={1} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-[#21262d]" />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[1, 5, 10, 20].map((n) => (
                      <button key={n} type="button" onClick={() => setBatchSize(n)}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition ${batchSize === n ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-[#050810] border-[#21262d] text-[#7d8590] hover:text-white"}`}>
                        {n === 1 ? "1 (safe)" : `×${n}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#484f58] mt-1.5">{batchSize === 1 ? "One call per message — safest for personalised texts." : `Up to ${batchSize} same-text recipients per gateway call.`}</p>
                </div>
                <div>
                  <label className="text-[#7d8590] block mb-1.5">SIM Card Slot:</label>
                  <input type="number" min={1} max={simSlotCount} value={selectedSim}
                    onChange={(e) => setSelectedSim(Math.min(simSlotCount, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full rounded-xl bg-[#050810] border border-[#21262d] px-3 py-2 text-white outline-none focus:border-[#238636]" />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {simSlotOptions.map((slot) => (
                      <button key={slot} type="button" onClick={() => setSelectedSim(slot)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${selectedSim === slot ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-[#050810] border-[#21262d] text-[#484f58]"}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[#7d8590] mb-1.5 flex items-center gap-1"><RefreshCw className="h-3 w-3 text-emerald-400" /> Failed Message Retry:</label>
                  <div className="rounded-xl bg-[#050810] border border-[#21262d] px-3 py-2.5 text-[11px] text-[#7d8590] leading-relaxed">
                    <p className="text-[#c9d1d9] font-semibold mb-0.5">Manual — after campaign ends</p>
                    Failed messages appear in <span className="text-emerald-400">/history</span>. Use <span className="text-amber-400">Sync Gateway Status</span> there to re-check delivery states.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#21262d] text-[11px] text-[#484f58]">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-emerald-500" /> ~{Math.floor(60000 / (delayMs || 1)) * batchSize} msg/min</span>
                <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-emerald-500" /> Est. {preparedRows.length === 0 ? "—" : (() => { const t = Math.ceil(preparedRows.length / batchSize) * delayMs; const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000); return m > 0 ? `${m}m ${s}s` : `${s}s`; })()} for {preparedRows.length} msgs</span>
              </div>
            </div>

            {/* Opt-out */}
            <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><ShieldOff className="h-4 w-4 text-rose-400" /> Do-Not-Send / Opt-Out List</label>
              <textarea rows={3} value={optOutRaw} onChange={(e) => setOptOutRaw(e.target.value)}
                placeholder="Numbers that replied STOP — one per line or comma-separated..."
                className="w-full rounded-xl border border-[#21262d] bg-[#161b22] p-3 text-xs font-mono text-white placeholder-[#484f58] outline-none focus:border-rose-500" />
              <p className="text-[11px] text-[#484f58]">{optOutSet.size} number(s) suppressed from all campaigns.</p>
            </div>

            {/* Schedule */}
            <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-emerald-400" /> Schedule for Later</label>
                <label className="flex items-center gap-1.5 text-xs text-[#7d8590] cursor-pointer">
                  <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="rounded accent-emerald-500" /> Enable Scheduling
                </label>
              </div>
              {isScheduled && (
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl bg-[#050810] border border-[#21262d] px-3 py-2 text-xs text-white outline-none focus:border-[#238636]" />
              )}
              {scheduleState === "scheduled" && (
                <div className="flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                  <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />{countdownLabel || "Waiting to launch…"}</span>
                  <button type="button" onClick={handleCancelSchedule} className="font-bold hover:text-white">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Right: launch console */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Target Audience</span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">{preparedRows.length} Ready</span>
              </div>
              {suppressedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                  <ShieldOff className="h-3.5 w-3.5" /> {suppressedCount} suppressed (opt-out)
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.entries(activeStats.operatorStats) as [string, number][]).map(([op, count]) =>
                  count > 0 ? (
                    <div key={op} className="p-2 rounded-xl bg-[#161b22] border border-[#21262d] flex items-center justify-between">
                      <OperatorBadge operator={op} size="sm" />
                      <span className="font-bold text-[#c9d1d9]">{count}</span>
                    </div>
                  ) : null
                )}
              </div>

              {/* Server-side info box */}
              <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 px-3 py-2.5 text-[11px] text-emerald-300 flex items-start gap-2">
                <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                <span>Campaign runs on the <strong>server</strong> after you click Launch. You can close this tab, refresh, or navigate freely — it will not stop.</span>
              </div>

              {!isRunning && scheduleState !== "scheduled" ? (
                <button type="button" onClick={handleStartCampaign}
                  disabled={preparedRows.length === 0 || isLaunching}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {isLaunching ? <RefreshCw className="h-4 w-4 animate-spin" /> : isScheduled ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {isLaunching ? "Starting on server…" : isScheduled ? "Schedule Campaign" : `Launch Campaign (${preparedRows.length} SMS)`}
                </button>
              ) : isRunning ? (
                <button type="button" onClick={handleCancelServerCampaign}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm transition">
                  <XCircle className="h-4 w-4" /> Stop Campaign
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom bar when server campaign is running */}
      {isRunning && serverProgress && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#30363d] bg-[#0d1117]/95 backdrop-blur-md px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center gap-4">
            <Zap className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-semibold text-white truncate">{serverProgress.campaignTitle}</span>
                <span className="text-emerald-400 font-mono font-bold tabular-nums ml-2 shrink-0">
                  {serverProgress.currentIndex}/{serverProgress.totalMessages} · {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {etaLabel && <span className="text-[#7d8590] hidden sm:block">{etaLabel}</span>}
              <button type="button" onClick={handleCancelServerCampaign}
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
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-[#7d8590] text-sm">Loading campaign engine…</div>
      </div>
    }>
      <BulkSmsInner />
    </Suspense>
  );
}
