"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
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
} from "lucide-react";

type BulkMode = "direct" | "csv" | "group";

interface ProcessRow {
  index: number;
  phone: string;
  nationalPhone?: string;
  operator?: PakistanOperator;
  text: string;
  status: "pending" | "sending" | "queued" | "failed" | "delivered";
  error?: string;
  id?: string;
}

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

  // Mode 3: Group Selection
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  // Shared Message Template
  const [messageTemplate, setMessageTemplate] = useState(
    "Salam {name}! Exclusive mega sale: FLAT 30% OFF on all items today only. Order now: https://store.pk/sale?utm_source=sms Code: PK30. Delivery all over Pakistan! 🇵🇰"
  );

  // Settings & Controls
  const [selectedSim, setSelectedSim] = useState<number>(gatewayConfig.simNumber || 1);
  const [delayMs, setDelayMs] = useState<number>(250);
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [deduplicate, setDeduplicate] = useState<boolean>(true);

  // Execution State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Rows being processed
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [currentProgress, setCurrentProgress] = useState<{
    total: number;
    completed: number;
    success: number;
    failed: number;
  }>({ total: 0, completed: 0, success: 0, failed: 0 });

  // 1. Parse Direct Numbers
  const directBatch = useMemo(() => {
    const rawLines = directNumbersRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return validatePakistanPhoneBatch(rawLines, deduplicate);
  }, [directNumbersRaw, deduplicate]);

  // 2. Parse CSV
  const { csvHeaders, csvRows, csvBatch } = useMemo(() => {
    const lines = csvRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { csvHeaders: [], csvRows: [], csvBatch: { valid: [], excluded: [], duplicatesCount: 0, operatorStats: {} as any } };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const phoneColIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("num"));
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
      parsedRows.push(rowObj);
      phoneInputs.push(rawPhone);
    }

    const batch = validatePakistanPhoneBatch(phoneInputs, deduplicate);
    return { csvHeaders: headers, csvRows: parsedRows, csvBatch: batch };
  }, [csvRaw, deduplicate]);

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

  // Filtered rows to send
  const preparedRows = useMemo(() => {
    const rows: ProcessRow[] = [];

    if (mode === "direct") {
      directBatch.valid.forEach((val, idx) => {
        if (filterOperator !== "all" && val.operator !== filterOperator) return;
        const text = interpolateTemplate(messageTemplate, {
          name: "Customer",
          phone: val.national || val.e164,
          operator: val.operator,
        });
        rows.push({
          index: idx,
          phone: val.e164 || "",
          nationalPhone: val.national,
          operator: val.operator,
          text,
          status: "pending",
        });
      });
    } else if (mode === "csv") {
      csvRows.forEach((row, idx) => {
        const val = validatePakistanPhone(row.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;

        const text = interpolateTemplate(messageTemplate, {
          ...row,
          operator: val.operator,
        });

        rows.push({
          index: idx,
          phone: val.e164,
          nationalPhone: val.national,
          operator: val.operator,
          text,
          status: "pending",
        });
      });
    } else {
      groupBatch.contacts.forEach((contact, idx) => {
        const val = validatePakistanPhone(contact.phone);
        if (!val.isValid || !val.e164) return;
        if (filterOperator !== "all" && val.operator !== filterOperator) return;

        const text = interpolateTemplate(messageTemplate, {
          name: contact.name,
          phone: contact.nationalPhone || contact.phone,
          operator: contact.operator,
          group: contact.group,
        });

        rows.push({
          index: idx,
          phone: val.e164,
          nationalPhone: val.national,
          operator: val.operator,
          text,
          status: "pending",
        });
      });
    }

    return rows;
  }, [mode, directBatch, csvRows, groupBatch, filterOperator, messageTemplate]);

  // SMS attributes for template preview
  const sampleAttrs = useMemo(() => {
    return calculateSMSAttributes(messageTemplate);
  }, [messageTemplate]);

  // Start Campaign Execution
  const handleStartCampaign = async () => {
    if (preparedRows.length === 0) {
      showToast("warning", "No valid recipients match the current filter.", "Empty Campaign");
      return;
    }

    setIsExecuting(true);
    setIsPaused(false);
    isCancelledRef.current = false;
    isPausedRef.current = false;

    const initialRows: ProcessRow[] = preparedRows.map((r) => ({ ...r, status: "pending" }));
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

    // Process sequentially or with micro-batches honoring delayMs to protect SIM carrier limits
    for (let i = 0; i < initialRows.length; i++) {
      if (isCancelledRef.current) break;

      // Handle pause
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const row = initialRows[i];

      // Mark row as sending
      setProcessRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "sending" } : r))
      );

      // Throttling delay
      if (delayMs > 0 && i > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

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
          items: [
            {
              phoneNumbers: [row.phone],
              text: row.text,
            },
          ],
        };

        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        const result = data?.results?.[0];

        if (res.ok && result?.ok) {
          successCount++;
          const rec: MessageRecord = {
            id: result.id || `msg_${Date.now()}_${i}`,
            phone: row.phone,
            nationalPhone: row.nationalPhone,
            operator: row.operator,
            text: row.text,
            status: "queued",
            gatewayId: result.id,
            timestamp: new Date().toISOString(),
            campaignId,
            campaignTitle,
            simNumber: selectedSim,
          };
          sentRecords.push(rec);

          setProcessRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "queued", id: result.id } : r
            )
          );
        } else {
          failCount++;
          const err = result?.error || data?.error || `HTTP ${res.status}`;
          const rec: MessageRecord = {
            id: `msg_err_${Date.now()}_${i}`,
            phone: row.phone,
            nationalPhone: row.nationalPhone,
            operator: row.operator,
            text: row.text,
            status: "failed",
            error: err,
            timestamp: new Date().toISOString(),
            campaignId,
            campaignTitle,
            simNumber: selectedSim,
          };
          sentRecords.push(rec);

          setProcessRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "failed", error: err } : r
            )
          );
        }
      } catch (err: unknown) {
        failCount++;
        const errStr = err instanceof Error ? err.message : "Network error";
        setProcessRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "failed", error: errStr } : r
          )
        );
      }

      setCurrentProgress({
        total: initialRows.length,
        completed: i + 1,
        success: successCount,
        failed: failCount,
      });
    }

    // Save messages in central context / DB
    if (sentRecords.length > 0) {
      addMessages(sentRecords);
    }

    // Save Campaign Record
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
    showToast(
      "success",
      `Campaign complete: ${successCount} accepted by gateway, ${failCount} failed.`,
      "Campaign Finished"
    );
  };

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

  // CSV Export of execution report
  const handleExportReport = () => {
    if (processRows.length === 0) return;
    const header = "Phone,National,Operator,Status,GatewayID,Error,Message\n";
    const body = processRows
      .map(
        (r) =>
          `"${r.phone}","${r.nationalPhone || ""}","${r.operator || ""}","${r.status}","${r.id || ""}","${(r.error || "").replace(/"/g, '""')}","${r.text.replace(/"/g, '""')}"`
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
  };

  // Insert tag helper
  const handleInsertTag = (tag: string) => {
    setMessageTemplate((prev) => `${prev} {${tag}}`);
  };

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
              Direct paste, dynamic CSV personalization, contact groups, carrier filtering, and carrier-safe rate throttling.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
        {/* Source Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
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

            {/* Mode 2: CSV / Excel Paste */}
            {mode === "csv" && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    Paste CSV Data or Column Mapping
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
                  value={csvRaw}
                  onChange={(e) => setCsvRaw(e.target.value)}
                  placeholder="phone,name,order_id,amount&#10;03001234567,Ahmed,9021,2500"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />

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

                {/* Templates quick picker */}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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

                {/* Throttling Delay */}
                <div>
                  <label className="text-slate-400 block mb-1.5">Delay Between SMS:</label>
                  <select
                    value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                  >
                    <option value={100}>100 ms (Fast)</option>
                    <option value={250}>250 ms (Balanced - Recommended)</option>
                    <option value={500}>500 ms (Cellular Safe)</option>
                    <option value={1000}>1,000 ms (Slow Anti-Spam)</option>
                  </select>
                </div>

                {/* SIM Selection */}
                <div>
                  <label className="text-slate-400 block mb-1.5">SIM Card Slot:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSim(1)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition ${
                        selectedSim === 1
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      SIM 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSim(2)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition ${
                        selectedSim === 2
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      SIM 2
                    </button>
                  </div>
                </div>
              </div>
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
              {!isExecuting ? (
                <button
                  type="button"
                  onClick={handleStartCampaign}
                  disabled={preparedRows.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                  <span>Launch Bulk Campaign ({preparedRows.length} SMS)</span>
                </button>
              ) : (
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
                </div>
              )}
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

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{
                      width: `${(currentProgress.completed / currentProgress.total) * 100}%`,
                    }}
                  />
                </div>

                {/* Counters */}
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

                {/* Export Report */}
                <div className="pt-2 flex justify-end">
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
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Batch Dispatch Stream ({processRows.length})
                </span>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {processRows.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{r.nationalPhone || r.phone}</span>
                          <OperatorBadge operator={r.operator} size="sm" />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{r.text}</p>
                      </div>

                      <div className="shrink-0">
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                    </div>
                  ))}
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

