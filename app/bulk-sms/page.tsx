"use client";

import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from "react";
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
  Upload,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Download,
  Filter,
  Layers,
  Sparkles,
  Smartphone,
  Sliders,
  XCircle,
  CalendarClock,
  Search,
  DollarSign,
  ShieldOff,
  Save,
  FolderOpen,
  Wand2,
  Trash2,
  RefreshCw,
  Timer,
  FileUp,
} from "lucide-react";

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
  selectedSim: number;
}

const DRAFTS_STORAGE_KEY = "bulk_sms_drafts_v1";
const OPTOUT_STORAGE_KEY = "bulk_sms_optout_v1";

function BulkSmsInner() {
  const {
    gatewayConfig,
    contacts,
    contactGroups,
    templates,
    addMessages,
    addCampaign,
    showToast,
  } = useSms();
  const searchParams = useSearchParams();

  // Pre-fill template from URL ?templateId=...
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);
  useEffect(() => {
    const templateId = searchParams.get("templateId");
    if (templateId && templates.length > 0) {
      const found = templates.find((t) => t.id === templateId);
      if (found) {
        setMessageTemplate(found.text);
        setLoadedTemplateName(found.name);
        showToast("info", `Template "${found.name}" loaded into Bulk SMS.`, "Template Loaded");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  // Mode selection
  const [mode, setMode] = useState<BulkMode>("direct");

  // Campaign Title
  const [campaignTitle, setCampaignTitle] = useState("Flash Sale Campaign - All Pakistan");

  // Mode 1: Direct Number List
  const [directNumbersRaw, setDirectNumbersRaw] = useState(
    "03001234567\n03121234567\n03331234567\n03451234567\n+923211234567\n923011234567"
  );

  // Mode 2: CSV Data
  const [csvRaw, setCsvRaw] = useState(
    "phone,name,order_id,amount\n03001234567,Ahmed Khan,9021,2500\n03121234567,Fatima Noor,9022,4200\n03331234567,Bilal Tariq,9023,1800\n03451234567,Zainab Ali,9024,3100"
  );
  const [phoneColumnOverride, setPhoneColumnOverride] = useState<string>("");
  const [nameColumnOverride, setNameColumnOverride] = useState<string>("");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  // Mode 3: Group Selection
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  // Shared Message Template
  const [messageTemplate, setMessageTemplate] = useState(
    "Salam {name}! Exclusive mega sale: FLAT 30% OFF on all items today only. Order now: https://store.pk/sale?utm_source=sms Code: PK30. Delivery all over Pakistan! 🇵🇰"
  );
  const [spintaxEnabled, setSpintaxEnabled] = useState(false);

  // Settings & Controls (numeric fields rendered as real number inputs w/ placeholders)
  const [selectedSim, setSelectedSim] = useState<number>(gatewayConfig.simNumber || 1);
  const [simSlotCount, setSimSlotCount] = useState<number>(2);
  const [delayMs, setDelayMs] = useState<number>(250);
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [deduplicate, setDeduplicate] = useState<boolean>(true);
  const [maxRetries, setMaxRetries] = useState<number>(1);
  const [costPerSegment, setCostPerSegment] = useState<number>(0.35);

  // Compliance / opt-out suppression list
  const [optOutRaw, setOptOutRaw] = useState<string>("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OPTOUT_STORAGE_KEY);
      if (saved) setOptOutRaw(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(OPTOUT_STORAGE_KEY, optOutRaw);
    } catch {
      /* ignore */
    }
  }, [optOutRaw]);

  const optOutSet = useMemo(() => {
    const lines = optOutRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const set = new Set<string>();
    lines.forEach((l) => {
      const v = validatePakistanPhone(l);
      if (v.isValid && v.e164) set.add(v.e164);
    });
    return set;
  }, [optOutRaw]);

  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [scheduleState, setScheduleState] = useState<ScheduleState>("idle");
  const [countdownLabel, setCountdownLabel] = useState<string>("");
  const scheduleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const executionStartRef = useRef<number>(0);

  // Rows being processed
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [currentProgress, setCurrentProgress] = useState<{
    total: number;
    completed: number;
    success: number;
    failed: number;
  }>({ total: 0, completed: 0, success: 0, failed: 0 });
  const [etaLabel, setEtaLabel] = useState<string>("");

  // Live stream search/filter
  const [streamSearch, setStreamSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");

  // Drafts
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persistDrafts = (next: CampaignDraft[]) => {
    setDrafts(next);
    try {
      window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // 1. Parse Direct Numbers
  const directBatch = useMemo(() => {
    const rawLines = directNumbersRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return validatePakistanPhoneBatch(rawLines, deduplicate);
  }, [directNumbersRaw, deduplicate]);

  // 2. Parse CSV (supports manual column mapping overrides)
  const { csvHeaders, csvRows, csvBatch } = useMemo(() => {
    const lines = csvRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { csvHeaders: [], csvRows: [], csvBatch: { valid: [], excluded: [], duplicatesCount: 0, operatorStats: {} as any } };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const autoPhoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("num"));
    const phoneColIdx = phoneColumnOverride && headers.includes(phoneColumnOverride)
      ? headers.indexOf(phoneColumnOverride)
      : autoPhoneIdx;
    const activePhoneIdx = phoneColIdx !== -1 ? phoneColIdx : 0;

    const parsedRows: Array<{ phone: string; [k: string]: string }> = [];
    const phoneInputs: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      const rawPhone = parts[activePhoneIdx] || "";
      const rowObj: { phone: string; [k: string]: string } = { phone: rawPhone };
      headers.forEach((h, idx) => {
        rowObj[h] = parts[idx] || "";
      });
      rowObj.phone = rawPhone;
      if (nameColumnOverride && headers.includes(nameColumnOverride)) {
        rowObj.name = parts[headers.indexOf(nameColumnOverride)] || rowObj.name || "";
      }
      parsedRows.push(rowObj);
      phoneInputs.push(rawPhone);
    }

    const batch = validatePakistanPhoneBatch(phoneInputs, deduplicate);
    return { csvHeaders: headers, csvRows: parsedRows, csvBatch: batch };
  }, [csvRaw, deduplicate, phoneColumnOverride, nameColumnOverride]);

  // 3. Parse Group Contacts
  const groupBatch = useMemo(() => {
    const filtered = selectedGroup
      ? contacts.filter((c) => c.group === selectedGroup)
      : contacts;
    const phoneInputs = filtered.map((c) => c.phone);
    return {
      contacts: filtered,
      batch: validatePakistanPhoneBatch(phoneInputs, deduplicate),
    };
  }, [contacts, selectedGroup, deduplicate]);

  // Active validation stats based on selected mode
  const activeStats = useMemo(() => {
    if (mode === "direct") return directBatch;
    if (mode === "csv") return csvBatch;
    return groupBatch.batch;
  }, [mode, directBatch, csvBatch, groupBatch]);

  // Spintax resolver — only touches {a|b|c} groups, leaves {tag} merge fields untouched
  const resolveSpintax = useCallback((text: string): string => {
    return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, group: string) => {
      const options = group.split("|");
      return options[Math.floor(Math.random() * options.length)];
    });
  }, []);

  // Filtered rows to send (opt-out suppression + spintax applied here)
  const { preparedRows, suppressedCount } = useMemo(() => {
    const rows: ProcessRow[] = [];
    let suppressed = 0;

    const buildText = (vars: Record<string, string | undefined>) => {
      const base = spintaxEnabled ? resolveSpintax(messageTemplate) : messageTemplate;
      return interpolateTemplate(base, vars);
    };

    const pushIfAllowed = (e164: string, row: Omit<ProcessRow, "status">) => {
      if (optOutSet.has(e164)) {
        suppressed++;
        return;
      }
      rows.push({ ...row, status: "pending" });
    };

    if (mode === "direct") {
      directBatch.valid.forEach((val, idx) => {
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        const text = buildText({
          name: "Customer",
          phone: val.national || val.e164,
          operator: val.operator,
        });
        pushIfAllowed(val.e164 || "", {
          index: idx,
          phone: val.e164 || "",
          nationalPhone: val.national,
          operator: val.operator,
          text,
        });
      });
    } else if (mode === "csv") {
      csvRows.forEach((row, idx) => {
        const val = validatePakistanPhone(row.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        const text = buildText({ ...row, operator: val.operator });
        pushIfAllowed(val.e164, {
          index: idx,
          phone: val.e164,
          nationalPhone: val.national,
          operator: val.operator,
          text,
        });
      });
    } else {
      groupBatch.contacts.forEach((contact, idx) => {
        const val = validatePakistanPhone(contact.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        const text = buildText({
          name: contact.name,
          phone: contact.nationalPhone || contact.phone,
          operator: contact.operator,
          group: contact.group,
        });
        pushIfAllowed(val.e164, {
          index: idx,
          phone: val.e164,
          nationalPhone: val.national,
          operator: val.operator,
          text,
        });
      });
    }

    return { preparedRows: rows, suppressedCount: suppressed };
  }, [mode, directBatch, csvRows, groupBatch, filterOperator, messageTemplate, spintaxEnabled, resolveSpintax, optOutSet]);

  // SMS attributes for template preview
  const sampleAttrs = useMemo(() => {
    return calculateSMSAttributes(messageTemplate);
  }, [messageTemplate]);

  // Filtered live stream rows
  const filteredProcessRows = useMemo(() => {
    return processRows.filter((r) => {
      if (streamFilter !== "all" && r.status !== streamFilter) return false;
      if (streamSearch.trim()) {
        const q = streamSearch.trim().toLowerCase();
        const haystack = `${r.phone} ${r.nationalPhone || ""} ${r.text}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [processRows, streamFilter, streamSearch]);

  // Core sender — extracted so both "Launch" and "Retry Failed" can call it
  const runCampaign = useCallback(
    async (rowsToSend: ProcessRow[]) => {
      if (rowsToSend.length === 0) {
        showToast("warning", "No valid recipients match the current filter.", "Empty Campaign");
        return;
      }

      setIsExecuting(true);
      setIsPaused(false);
      isCancelledRef.current = false;
      isPausedRef.current = false;
      executionStartRef.current = Date.now();

      const initialRows: ProcessRow[] = rowsToSend.map((r) => ({ ...r, status: "pending", attempts: 0 }));
      setProcessRows(initialRows);

      setCurrentProgress({
        total: initialRows.length,
        completed: 0,
        success: 0,
        failed: 0,
      });

      const campaignId = `cmp_${Date.now()}`;
      const sentRecords: MessageRecord[] = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < initialRows.length; i++) {
        if (isCancelledRef.current) break;

        while (isPausedRef.current && !isCancelledRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }

        const row = initialRows[i];

        setProcessRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "sending" } : r))
        );

        if (delayMs > 0 && i > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        let attempt = 0;
        let ok = false;
        let lastError = "";
        let lastResultId: string | undefined;

        while (attempt <= maxRetries && !ok && !isCancelledRef.current) {
          attempt++;
          try {
            const payload = {
              username: gatewayConfig.username,
              password: gatewayConfig.password,
              baseUrl: gatewayConfig.baseUrl,
              deviceId: gatewayConfig.deviceId,
              simNumber: selectedSim,
              withDeliveryReport: true,
              campaignId,
              campaignTitle,
              items: [{ phoneNumbers: [row.phone], text: row.text }],
            };

            const res = await fetch("/api/sms/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            const data = await res.json();
            const result = data?.results?.[0];

            if (res.ok && result?.ok) {
              ok = true;
              lastResultId = result.id;
            } else {
              lastError = result?.error || data?.error || `HTTP ${res.status}`;
              if (attempt <= maxRetries) {
                await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
              }
            }
          } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : "Network error";
            if (attempt <= maxRetries) {
              await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
            }
          }
        }

        if (ok) {
          successCount++;
          const rec: MessageRecord = {
            id: lastResultId || `msg_${Date.now()}_${i}`,
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
          sentRecords.push(rec);
          setProcessRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "queued", id: lastResultId, attempts: attempt } : r))
          );
        } else {
          failCount++;
          const rec: MessageRecord = {
            id: `msg_err_${Date.now()}_${i}`,
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
          sentRecords.push(rec);
          setProcessRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "failed", error: lastError, attempts: attempt } : r))
          );
        }

        const completed = i + 1;
        setCurrentProgress({
          total: initialRows.length,
          completed,
          success: successCount,
          failed: failCount,
        });

        const remaining = initialRows.length - completed;
        const elapsed = Date.now() - executionStartRef.current;
        const perItem = completed > 0 ? elapsed / completed : delayMs;
        const remainingMs = Math.max(0, Math.round(perItem * remaining));
        const secs = Math.floor(remainingMs / 1000) % 60;
        const mins = Math.floor(remainingMs / 60000);
        setEtaLabel(remaining > 0 ? `${mins}m ${secs}s remaining` : "");
      }

      if (sentRecords.length > 0) {
        addMessages(sentRecords);
      }

      const campaignRecord: CampaignRecord = {
        id: campaignId,
        title: campaignTitle,
        createdAt: new Date().toISOString(),
        totalRecipients: initialRows.length,
        sentCount: successCount,
        failedCount: failCount,
        operatorStats: activeStats.operatorStats,
        status: isCancelledRef.current ? "cancelled" : "completed",
        textTemplate: messageTemplate,
        simNumber: selectedSim,
      };
      addCampaign(campaignRecord);

      setIsExecuting(false);
      setEtaLabel("");
      showToast(
        "success",
        `Campaign complete: ${successCount} accepted by gateway, ${failCount} failed.`,
        "Campaign Finished"
      );
    },
    [
      gatewayConfig,
      selectedSim,
      campaignTitle,
      delayMs,
      maxRetries,
      activeStats.operatorStats,
      messageTemplate,
      addMessages,
      addCampaign,
      showToast,
    ]
  );

  // Launch — handles immediate send or scheduling
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
      showToast("info", "Campaign resumed", "Resumed");
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      showToast("warning", "Campaign paused", "Paused");
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsExecuting(false);
    showToast("warning", "Campaign execution cancelled.", "Stopped");
  };

  const handleRetryFailed = () => {
    const failedRows = processRows.filter((r) => r.status === "failed");
    if (failedRows.length === 0) {
      showToast("info", "No failed messages to retry.", "Nothing to Retry");
      return;
    }
    runCampaign(failedRows);
  };

  // CSV Export of execution report
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
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sms_campaign_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Insert tag helper
  const handleInsertTag = (tag: string) => {
    setMessageTemplate((prev) => `${prev} {${tag}}`);
  };

  // CSV file upload (input or drag/drop)
  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setCsvRaw(text.trim());
      setPhoneColumnOverride("");
      setNameColumnOverride("");
      showToast("success", `Loaded ${file.name} into the CSV editor.`, "File Loaded");
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

  // Draft management
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
    setSelectedSim(draft.selectedSim);
    showToast("info", `Loaded draft "${draft.name}".`, "Draft Loaded");
  };

  const handleDeleteDraft = (id: string) => {
    persistDrafts(drafts.filter((d) => d.id !== id));
  };

  const simSlotOptions = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(simSlotCount, 12)) }, (_, i) => i + 1),
    [simSlotCount]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Send className="h-3 w-3" />
                Bulk Campaign Dispatcher
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Personalized Bulk SMS Engine
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct paste, dynamic CSV personalization, contact groups, carrier filtering, scheduling, compliance opt-outs, and carrier-safe rate throttling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              title="Save current setup as a draft"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </button>
            <input
              type="text"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              placeholder="Campaign Title..."
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Drafts row */}
        {drafts.length > 0 && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 flex items-center gap-2 overflow-x-auto">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              <FolderOpen className="h-3.5 w-3.5" />
              Drafts
            </span>
            {drafts.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1.5 shrink-0 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1"
              >
                <button
                  type="button"
                  onClick={() => handleLoadDraft(d)}
                  className="text-xs text-slate-300 hover:text-emerald-400 font-medium"
                >
                  {d.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDraft(d.id)}
                  className="text-slate-600 hover:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Source Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              mode === "direct"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Direct Number List</span>
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
              {directBatch.valid.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("csv")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              mode === "csv"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>CSV / Excel Upload & Tags</span>
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
              {csvBatch.valid.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("group")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              mode === "group"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Phonebook Groups</span>
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
              {groupBatch.batch.valid.length}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Data input & Message Template (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode 1: Direct Number Input */}
            {mode === "direct" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    Paste Pakistani Mobile Numbers
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deduplicate}
                      onChange={(e) => setDeduplicate(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Remove Duplicates</span>
                  </label>
                </div>

                <textarea
                  rows={6}
                  value={directNumbersRaw}
                  onChange={(e) => setDirectNumbersRaw(e.target.value)}
                  placeholder="Paste Pakistani numbers (03xx, +923xx, one per line or comma-separated)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />

                {/* Batch stats chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {directBatch.valid.length} Valid Mobile
                  </span>
                  {directBatch.duplicatesCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-500/30 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      {directBatch.duplicatesCount} Duplicates Filtered
                    </span>
                  )}
                  {directBatch.excluded.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-500/30 font-semibold">
                      <XCircle className="h-3.5 w-3.5 text-rose-400" />
                      {directBatch.excluded.length} Invalid / Landline Excluded
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: CSV / Excel Paste + Upload */}
            {mode === "csv" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    Paste CSV Data or Upload a File
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deduplicate}
                      onChange={(e) => setDeduplicate(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Remove Duplicates</span>
                  </label>
                </div>

                {/* Drag & drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingCsv(true);
                  }}
                  onDragLeave={() => setIsDraggingCsv(false)}
                  onDrop={handleCsvDrop}
                  onClick={() => csvFileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-xs cursor-pointer transition ${
                    isDraggingCsv
                      ? "border-emerald-500 bg-emerald-950/20 text-emerald-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <FileUp className="h-4 w-4" />
                  <span>Drag & drop a .csv file here, or click to browse</span>
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCsvFileInput}
                  />
                </div>

                <textarea
                  rows={6}
                  value={csvRaw}
                  onChange={(e) => setCsvRaw(e.target.value)}
                  placeholder="phone,name,order_id,amount&#10;03001234567,Ahmed,9021,2500"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />

                {/* Column mapping */}
                {csvHeaders.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Phone column</label>
                      <select
                        value={phoneColumnOverride}
                        onChange={(e) => setPhoneColumnOverride(e.target.value)}
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                      >
                        <option value="">Auto-detect</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-medium">Name column</label>
                      <select
                        value={nameColumnOverride}
                        onChange={(e) => setNameColumnOverride(e.target.value)}
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                      >
                        <option value="">Auto ("name" header)</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Detected CSV columns for tag insertion */}
                {csvHeaders.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                      Click to insert personalized dynamic tags into your message:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {csvHeaders.map((header) => (
                        <button
                          key={header}
                          type="button"
                          onClick={() => handleInsertTag(header)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold transition"
                        >
                          +{`{${header}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Group Selection */}
            {mode === "group" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Select Contact Group from Phonebook
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup("")}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedGroup === ""
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="font-bold text-xs block">All Contacts</span>
                    <span className="text-[10px] text-slate-500">{contacts.length} recipients</span>
                  </button>

                  {contactGroups.map((grp) => {
                    const count = contacts.filter((c) => c.group === grp).length;
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setSelectedGroup(grp)}
                        className={`p-3 rounded-xl border text-left transition ${
                          selectedGroup === grp
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="font-bold text-xs block">{grp}</span>
                        <span className="text-[10px] text-slate-500">{count} recipients</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Template Editor */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Campaign SMS Template
                  {loadedTemplateName && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 normal-case tracking-normal">
                      📋 {loadedTemplateName}
                    </span>
                  )}
                </label>

                {templates.length > 0 && (
                  <select
                    onChange={(e) => {
                      const t = templates.find((tpl) => tpl.id === e.target.value);
                      if (t) {
                        setMessageTemplate(t.text);
                        setLoadedTemplateName(t.name);
                      }
                    }}
                    className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-300 outline-none max-w-[220px]"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Load from Templates...
                    </option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <textarea
                rows={5}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Enter SMS template with {name} or custom tags..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-sans leading-relaxed"
              />

              {/* Spintax toggle */}
              <label className="flex items-start gap-2 text-[11px] text-slate-400 cursor-pointer bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <input
                  type="checkbox"
                  checked={spintaxEnabled}
                  onChange={(e) => setSpintaxEnabled(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500"
                />
                <span>
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Wand2 className="h-3 w-3 text-emerald-400" />
                    Enable spintax wording variation
                  </span>
                  Wrap alternatives like <code className="text-emerald-400">{"{Hi|Salam|Hello}"}</code> in your
                  template — each recipient gets a randomly picked variant, which helps avoid identical-message spam filters.
                </span>
              </label>

              {/* Segment & Encoding counter */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Length: <strong className="text-white">{sampleAttrs.charCount}</strong> chars &bull;{" "}
                  <strong className="text-emerald-400">{sampleAttrs.segments}</strong>{" "}
                  {sampleAttrs.segments === 1 ? "part" : "parts"}
                </span>
                <span className={sampleAttrs.hasUnicode ? "text-amber-400" : "text-slate-400"}>
                  {sampleAttrs.encoding}
                </span>
              </div>
            </div>

            {/* Settings & Carrier Filter */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-emerald-400" />
                Dispatch & Telecom Safeguards
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Operator Filter */}
                <div>
                  <label className="text-slate-400 block mb-1.5">Filter by Network:</label>
                  <select
                    value={filterOperator}
                    onChange={(e) => setFilterOperator(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Networks (Nationwide)</option>
                    <option value="Jazz">Jazz / Mobilink Only</option>
                    <option value="Zong">Zong Only</option>
                    <option value="Telenor">Telenor Only</option>
                    <option value="Ufone">Ufone Only</option>
                    <option value="SCOM">SCOM Only</option>
                  </select>
                </div>

                {/* Throttling Delay — now a real number input with placeholder */}
                <div>
                  <label className="text-slate-400 block mb-1.5">Delay Between SMS (ms):</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="e.g. 250"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">250–500ms is generally carrier-safe.</span>
                </div>

                {/* SIM Card Slot — real number input with placeholder instead of fixed buttons */}
                <div>
                  <label className="text-slate-400 block mb-1.5">SIM Card Slot:</label>
                  <input
                    type="number"
                    min={1}
                    max={simSlotCount}
                    value={selectedSim}
                    onChange={(e) =>
                      setSelectedSim(Math.min(simSlotCount, Math.max(1, Number(e.target.value) || 1)))
                    }
                    placeholder="e.g. 1"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {simSlotOptions.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSim(slot)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                          selectedSim === slot
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

               

                {/* Max retries — number input */}
                <div>
                  <label className="text-slate-400 block mb-1.5 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Auto-Retry Attempts:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Math.min(5, Math.max(0, Number(e.target.value) || 0)))}
                    placeholder="e.g. 1"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                
              </div>
            </div>

            {/* Compliance / Opt-Out list */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldOff className="h-4 w-4 text-rose-400" />
                Do-Not-Send / Opt-Out Suppression List
              </label>
              <textarea
                rows={3}
                value={optOutRaw}
                onChange={(e) => setOptOutRaw(e.target.value)}
                placeholder="Paste numbers that opted out (STOP replies etc.) — one per line or comma-separated..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-rose-500"
              />
              <p className="text-[11px] text-slate-500">
                {optOutSet.size} number(s) on this list will be silently skipped from every campaign, and are saved locally in this browser.
              </p>
            </div>

            {/* Scheduling */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-emerald-400" />
                  Schedule for Later
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span>Enable Scheduling</span>
                </label>
              </div>
              {isScheduled && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              )}
              {scheduleState === "scheduled" && (
                <div className="flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    {countdownLabel || "Waiting to launch…"}
                  </span>
                  <button type="button" onClick={handleCancelSchedule} className="font-bold hover:text-white">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Execution Console & Live Feed (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Campaign Summary & Launch Trigger */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Target Audience Summary
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {preparedRows.length} Ready
                </span>
              </div>

              {suppressedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                  <ShieldOff className="h-3.5 w-3.5" />
                  {suppressedCount} recipient(s) suppressed due to opt-out list
                </div>
              )}

              {/* Carrier Breakdown Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.entries(activeStats.operatorStats) as [string, number][]).map(([op, count]) => {
                  if (count === 0) return null;
                  return (
                    <div
                      key={op}
                      className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                    >
                      <OperatorBadge operator={op} size="sm" />
                      <span className="font-bold text-slate-300">{count}</span>
                    </div>
                  );
                })}
              </div>

             

              {/* Main Launch Button */}
              {!isExecuting && scheduleState !== "scheduled" ? (
                <button
                  type="button"
                  onClick={handleStartCampaign}
                  disabled={preparedRows.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScheduled ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  <span>
                    {isScheduled ? "Schedule" : "Launch"} Bulk Campaign ({preparedRows.length} SMS)
                  </span>
                </button>
              ) : isExecuting ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePauseResume}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                    >
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      <span>{isPaused ? "Resume Campaign" : "Pause"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Stop Campaign</span>
                    </button>
                  </div>
                  {etaLabel && (
                    <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> {etaLabel}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Live Progress Bar & Counters (during/after execution) */}
            {currentProgress.total > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    Campaign Execution Progress
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {Math.round((currentProgress.completed / currentProgress.total) * 100)}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{
                      width: `${(currentProgress.completed / currentProgress.total) * 100}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Total</span>
                    <span className="font-bold text-white">{currentProgress.total}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-emerald-400 block">Accepted</span>
                    <span className="font-bold text-emerald-400">{currentProgress.success}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-rose-400 block">Failed</span>
                    <span className="font-bold text-rose-400">{currentProgress.failed}</span>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap justify-end gap-2">
                  {!isExecuting && currentProgress.failed > 0 && (
                    <button
                      type="button"
                      onClick={handleRetryFailed}
                      className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-white px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30 transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry {currentProgress.failed} Failed</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportReport}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Delivery Report CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Message Row Log Feed */}
            {processRows.length > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Batch Dispatch Stream ({filteredProcessRows.length}/{processRows.length})
                  </span>
                </div>

                {/* Search + status filter */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={streamSearch}
                      onChange={(e) => setStreamSearch(e.target.value)}
                      placeholder="Search phone or message..."
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select
                    value={streamFilter}
                    onChange={(e) => setStreamFilter(e.target.value as StreamFilter)}
                    className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="sending">Sending</option>
                    <option value="queued">Queued</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {filteredProcessRows.map((r, i) => (
                    <div
                      key={`${r.phone}_${i}`}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{r.nationalPhone || r.phone}</span>
                          <OperatorBadge operator={r.operator} size="sm" />
                          {(r.attempts ?? 0) > 1 && (
                            <span className="text-[10px] text-amber-400">×{r.attempts}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{r.text}</p>
                        {r.error && <p className="text-[10px] text-rose-400 truncate max-w-xs">{r.error}</p>}
                      </div>

                      <div className="shrink-0">
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                    </div>
                  ))}
                  {filteredProcessRows.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-4">No rows match your filters.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BulkSmsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-slate-400 text-sm">Loading campaign...</div></div>}>
      <BulkSmsInner />
    </Suspense>
  );
}