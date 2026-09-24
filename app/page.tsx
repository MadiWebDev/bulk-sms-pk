"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  validatePakistanPhone,
  validatePakistanPhoneBatch,
  PakistanPhoneValidation,
  PakistanOperator,
} from "@/lib/pakistan-phone";
import {
  calculateSMSAttributes,
  extractUrls,
  ensureHttpUrl,
  interpolateTemplate,
  buildWhatsAppLink,
  appendUtmTags,
} from "@/lib/sms-text";

type SendMode = "quick" | "csv" | "single_test";
type RowStatus = "pending" | "sending" | "queued" | "failed" | "delivered";

interface DisplayRow {
  phone: string;
  nationalPhone?: string;
  operator?: PakistanOperator;
  text: string;
  status: RowStatus;
  id?: string;
  state?: string;
  error?: string;
  timestamp?: string;
}

interface CsvRow {
  phone: string;
  [key: string]: string;
}

const PRESET_TEMPLATES = [
  {
    name: "Special Promotion with Website Link",
    text: "Salam {name}! Enjoy FLAT 30% OFF on all items today only. Shop now: https://yoursite.pk/sale?utm_source=sms Use code: PK30. Delivery nationwide across Pakistan.",
  },
  {
    name: "Customer Support & WhatsApp Link",
    text: "Dear {name}, your inquiry has been received. Connect with our official WhatsApp support team directly at https://wa.me/923001234567 for instant assistance.",
  },
  {
    name: "Order Tracking Notification",
    text: "Hi {name}, your order #8921 has been dispatched via courier! Track your parcel live here: https://track.courier.pk/8921 . Delivery in 24-48 hours.",
  },
  {
    name: "Event / Webinar Invitation",
    text: "Exclusive Invitation for {name}: Join our free digital workshop this Sunday. Reserve your seat here: https://webinar.pk/register . Limited spots available!",
  },
];

export default function BulkSmsPakistan() {
  // Gateway Settings
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.sms-gate.app/3rdparty/v1");
  const [deviceId, setDeviceId] = useState("");
  const [simNumber, setSimNumber] = useState<string>("1");
  const [withDeliveryReport, setWithDeliveryReport] = useState(true);
  const [delayMs, setDelayMs] = useState(250);

  // Settings State & Diagnostics
  const [envLoaded, setEnvLoaded] = useState(false);
  const [maskedEnvUser, setMaskedEnvUser] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [testConnStatus, setTestConnStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Mode & Inputs
  const [mode, setMode] = useState<SendMode>("quick");
  const [quickNumbersRaw, setQuickNumbersRaw] = useState(
    "03001234567\n03129876543\n03335551234\n03456789012\n+92 321 4455667\n+1 555 123 4567\n051 9201234"
  );
  const [messageText, setMessageText] = useState(
    "Salam! Check out our new online store catalog at https://mystore.pk/catalog . Special free delivery across Pakistan for orders placed today!"
  );

  // CSV Mode
  const [csvRaw, setCsvRaw] = useState(
    "phone,name,order_id\n03001234567,Ali,PK-101\n03129876543,Fatima,PK-102\n03335551234,Usman,PK-103\n+15559998888,John,PK-104"
  );
  const [templateText, setTemplateText] = useState(
    "Salam {name}! Your order #{order_id} has been packed. Track status here: https://track.pk/{order_id} . Thank you!"
  );

  // Single Test Mode
  const [singlePhone, setSinglePhone] = useState("");
  const [singleText, setSingleText] = useState(
    "Test SMS from sms-gate.app gateway. Live link test: https://sms-gate.app/ . Working perfectly!"
  );

  // Validation Views
  const [activeTab, setActiveTab] = useState<"valid" | "excluded">("valid");
  const [filterOperator, setFilterOperator] = useState<string>("ALL");

  // Execution & Progress State
  const [sending, setSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, failed: 0 });
  const [bannerAlert, setBannerAlert] = useState<{ type: "error" | "success" | "info"; msg: string } | null>(null);

  // Fetch initial env config on load
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/sms/config");
        if (res.ok) {
          const data = await res.json();
          if (data.isConfigured) {
            setEnvLoaded(true);
            setMaskedEnvUser(data.maskedUsername || "Configured in .env");
            if (data.deviceId) setDeviceId(data.deviceId);
            if (data.simNumber) setSimNumber(String(data.simNumber));
            if (data.baseUrl) setBaseUrl(data.baseUrl);
          }
        }
      } catch {
        // ignore error
      }
    }
    loadConfig();
  }, []);

  // Quick mode phone validation
  const quickParsedBatch = useMemo(() => {
    const lines = quickNumbersRaw
      .split(/[\r\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return validatePakistanPhoneBatch(lines, true);
  }, [quickNumbersRaw]);

  // CSV parsing & validation
  const csvParsed = useMemo(() => {
    const lines = csvRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { rows: [] as CsvRow[], headers: [], errors: ["CSV requires a header and at least 1 data row"], excluded: [] as PakistanPhoneValidation[], valid: [] as CsvRow[] };
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const phoneIdx = headers.indexOf("phone");
    if (phoneIdx === -1) {
      return { rows: [] as CsvRow[], headers, errors: ['CSV header must include a "phone" column'], excluded: [] as PakistanPhoneValidation[], valid: [] as CsvRow[] };
    }

    const validRows: CsvRow[] = [];
    const excludedList: PakistanPhoneValidation[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim());
      if (cells.length < headers.length) continue;
      const rowObj: CsvRow = { phone: "" };
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] || "";
      });

      const check = validatePakistanPhone(rowObj.phone);
      if (check.isValid && check.e164) {
        if (!seen.has(check.e164)) {
          seen.add(check.e164);
          rowObj.phone = check.e164;
          rowObj._national = check.national || "";
          rowObj._operator = check.operator || "Unknown";
          validRows.push(rowObj);
        }
      } else {
        excludedList.push(check);
      }
    }

    return { rows: validRows, headers, errors: [], excluded: excludedList, valid: validRows };
  }, [csvRaw]);

  // Single phone check
  const singlePhoneCheck = useMemo(() => {
    if (!singlePhone.trim()) return null;
    return validatePakistanPhone(singlePhone);
  }, [singlePhone]);

  // Current active text for analyzer & preview
  const currentComposerText = useMemo(() => {
    if (mode === "quick") return messageText;
    if (mode === "csv") {
      const sample = csvParsed.valid[0] || { name: "Customer", order_id: "PK-100" };
      return interpolateTemplate(templateText, sample);
    }
    return singleText;
  }, [mode, messageText, templateText, singleText, csvParsed.valid]);

  // SMS Text Analyzer
  const smsAttributes = useMemo(() => {
    return calculateSMSAttributes(currentComposerText);
  }, [currentComposerText]);

  // Operator color helper
  const getOperatorBadge = (op?: PakistanOperator) => {
    switch (op) {
      case "Jazz":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Zong":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Ufone":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Telenor":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "SCOM":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Test Gateway Connection
  async function handleTestConnection() {
    setTestConnStatus({ loading: true });
    try {
      const res = await fetch("/api/sms/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestConnStatus({
          loading: false,
          success: true,
          message: data.message || "Connection successful! Gateway is ready.",
        });
      } else {
        setTestConnStatus({
          loading: false,
          success: false,
          message: data.error || `HTTP ${res.status}: Connection failed`,
        });
      }
    } catch (e) {
      setTestConnStatus({
        loading: false,
        success: false,
        message: e instanceof Error ? e.message : "Network error contacting gateway tester",
      });
    }
  }

  // Insert URL helper
  function insertUrlToComposer(urlToInsert: string) {
    if (mode === "quick") {
      setMessageText((prev) => (prev ? `${prev} ${urlToInsert}` : urlToInsert));
    } else if (mode === "csv") {
      setTemplateText((prev) => (prev ? `${prev} ${urlToInsert}` : urlToInsert));
    } else {
      setSingleText((prev) => (prev ? `${prev} ${urlToInsert}` : urlToInsert));
    }
  }

  // Single test send
  async function handleSendSingleTest() {
    if (!singlePhoneCheck?.isValid || !singlePhoneCheck.e164) {
      setBannerAlert({ type: "error", msg: "Please enter a valid Pakistani mobile number (e.g. 03001234567)." });
      return;
    }
    if (!singleText.trim()) {
      setBannerAlert({ type: "error", msg: "Message text cannot be empty." });
      return;
    }

    setSending(true);
    setBannerAlert(null);

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          deviceId: deviceId.trim() || undefined,
          simNumber: simNumber.trim() ? Number(simNumber) : 1,
          withDeliveryReport,
          items: [{ phoneNumbers: [singlePhoneCheck.e164], text: singleText.trim() }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBannerAlert({ type: "error", msg: data?.error || `Failed with status ${res.status}` });
      } else {
        const itemRes = data.results?.[0];
        if (itemRes?.ok) {
          setBannerAlert({
            type: "success",
            msg: `SMS Queued successfully to ${singlePhoneCheck.e164}! Message ID: ${itemRes.id || "Enqueued"}`,
          });
          // Add to rows table
          setRows((prev) => [
            {
              phone: singlePhoneCheck.e164!,
              nationalPhone: singlePhoneCheck.national,
              operator: singlePhoneCheck.operator,
              text: singleText,
              status: "queued",
              id: itemRes.id,
              state: itemRes.state || "Enqueued",
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ]);
        } else {
          setBannerAlert({ type: "error", msg: itemRes?.error || "Gateway rejected message." });
        }
      }
    } catch (e) {
      setBannerAlert({ type: "error", msg: e instanceof Error ? e.message : "Error sending test SMS" });
    } finally {
      setSending(false);
    }
  }

  // Bulk Send Runner
  async function handleBulkSend() {
    setBannerAlert(null);
    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);

    let itemsToSend: { phoneNumbers: string[]; text: string; origIdx: number; rowRef: DisplayRow }[] = [];
    const baseDisplayRows: DisplayRow[] = [];

    if (mode === "quick") {
      const validNumbers = quickParsedBatch.valid;
      if (validNumbers.length === 0) {
        setBannerAlert({ type: "error", msg: "No valid Pakistan numbers found in your input." });
        return;
      }
      if (!messageText.trim()) {
        setBannerAlert({ type: "error", msg: "Message text cannot be empty." });
        return;
      }

      validNumbers.forEach((val, i) => {
        const row: DisplayRow = {
          phone: val.e164!,
          nationalPhone: val.national,
          operator: val.operator,
          text: messageText.trim(),
          status: "pending",
          timestamp: new Date().toLocaleTimeString(),
        };
        baseDisplayRows.push(row);
        itemsToSend.push({
          phoneNumbers: [val.e164!],
          text: messageText.trim(),
          origIdx: i,
          rowRef: row,
        });
      });
    } else if (mode === "csv") {
      if (csvParsed.errors.length > 0) {
        setBannerAlert({ type: "error", msg: csvParsed.errors[0] });
        return;
      }
      if (csvParsed.valid.length === 0) {
        setBannerAlert({ type: "error", msg: "CSV contains no valid Pakistan recipient rows." });
        return;
      }
      if (!templateText.trim()) {
        setBannerAlert({ type: "error", msg: "Template text cannot be empty." });
        return;
      }

      csvParsed.valid.forEach((row, i) => {
        const msg = interpolateTemplate(templateText, row);
        const disp: DisplayRow = {
          phone: row.phone,
          nationalPhone: row._national,
          operator: row._operator as PakistanOperator,
          text: msg,
          status: "pending",
          timestamp: new Date().toLocaleTimeString(),
        };
        baseDisplayRows.push(disp);
        itemsToSend.push({
          phoneNumbers: [row.phone],
          text: msg,
          origIdx: i,
          rowRef: disp,
        });
      });
    }

    setRows(baseDisplayRows);
    setSending(true);
    setProgress({ done: 0, total: itemsToSend.length, success: 0, failed: 0 });

    // Send in chunks of 5 items per HTTP request
    const CHUNK_SIZE = 5;
    let doneCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (let c = 0; c < itemsToSend.length; c += CHUNK_SIZE) {
      if (isCancelledRef.current) break;

      // Handle pause loop
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }

      const chunk = itemsToSend.slice(c, c + CHUNK_SIZE);
      const apiPayloadItems = chunk.map((item) => ({
        phoneNumbers: item.phoneNumbers,
        text: item.text,
      }));

      try {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim() || undefined,
            password: password.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
            deviceId: deviceId.trim() || undefined,
            simNumber: simNumber.trim() ? Number(simNumber) : 1,
            withDeliveryReport,
            delayMs,
            items: apiPayloadItems,
          }),
        });

        const data = await res.json();
        const results = data.results || [];

        setRows((prev) => {
          const next = [...prev];
          chunk.forEach((item, idx) => {
            const r = results[idx];
            const targetIdx = item.origIdx;
            if (next[targetIdx]) {
              if (r && r.ok) {
                next[targetIdx] = {
                  ...next[targetIdx],
                  status: "queued",
                  id: r.id,
                  state: r.state || "Enqueued",
                };
                successCount++;
              } else {
                next[targetIdx] = {
                  ...next[targetIdx],
                  status: "failed",
                  error: r?.error || "Sending failed",
                };
                failedCount++;
              }
            }
          });
          return next;
        });
      } catch (err) {
        chunk.forEach((item) => {
          failedCount++;
          setRows((prev) => {
            const next = [...prev];
            if (next[item.origIdx]) {
              next[item.origIdx] = {
                ...next[item.origIdx],
                status: "failed",
                error: err instanceof Error ? err.message : "Network error",
              };
            }
            return next;
          });
        });
      }

      doneCount += chunk.length;
      setProgress({
        done: doneCount,
        total: itemsToSend.length,
        success: successCount,
        failed: failedCount,
      });

      // Throttle delay between chunks
      if (delayMs > 0 && c + CHUNK_SIZE < itemsToSend.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    setSending(false);
    setIsPaused(false);
  }

  function handlePauseToggle() {
    const next = !isPaused;
    setIsPaused(next);
    isPausedRef.current = next;
  }

  function handleCancel() {
    isCancelledRef.current = true;
    setIsPaused(false);
    setSending(false);
  }

  // Check status of a single row
  async function handleCheckStatus(id: string, rowIndex: number) {
    if (!id) return;
    try {
      const res = await fetch("/api/sms/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          id,
        }),
      });
      const data = await res.json();
      if (res.ok && data) {
        setRows((prev) => {
          const next = [...prev];
          if (next[rowIndex]) {
            const state = data.state || data.recipients?.[0]?.state || "Unknown";
            next[rowIndex] = {
              ...next[rowIndex],
              state,
              status: state.toLowerCase().includes("deliver") ? "delivered" : next[rowIndex].status,
            };
          }
          return next;
        });
      }
    } catch {
      // ignore
    }
  }

  // Export results to CSV
  function handleExportCSV() {
    if (rows.length === 0) return;
    const headers = ["Phone", "NationalFormat", "Operator", "Status", "MessageID", "GatewayState", "Error", "Message"];
    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        [
          `"${r.phone}"`,
          `"${r.nationalPhone || ""}"`,
          `"${r.operator || ""}"`,
          `"${r.status}"`,
          `"${r.id || ""}"`,
          `"${r.state || ""}"`,
          `"${(r.error || "").replace(/"/g, '""')}"`,
          `"${r.text.replace(/"/g, '""').replace(/\n/g, " ")}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sms_campaign_pakistan_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered rows for results table
  const displayedResults = useMemo(() => {
    if (filterOperator === "ALL") return rows;
    return rows.filter((r) => r.operator === filterOperator);
  }, [rows, filterOperator]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-24">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md shadow-emerald-500/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">SMS Gateway Pakistan</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                  🇵🇰 PK Mobile Only
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Powered by <a href="https://sms-gate.app/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">sms-gate.app</a> &bull; E.164 +92 Standard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Gateway Indicator */}
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300">
              <span className={`h-2 w-2 rounded-full ${envLoaded ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{envLoaded ? `Env Active (${maskedEnvUser})` : "Using Manual Settings"}</span>
            </div>

            {/* Quick Test Connection Button */}
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testConnStatus.loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <svg className={`h-3.5 w-3.5 ${testConnStatus.loading ? "animate-spin text-emerald-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{testConnStatus.loading ? "Testing..." : "Test Connection"}</span>
            </button>

            {/* Settings Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Gateway Config</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* Banner Alert */}
        {bannerAlert && (
          <div
            className={`mb-6 flex items-center justify-between rounded-xl border p-4 text-sm ${
              bannerAlert.type === "error"
                ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
                : bannerAlert.type === "success"
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                : "border-blue-500/40 bg-blue-950/40 text-blue-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {bannerAlert.type === "error" ? "Notice:" : bannerAlert.type === "success" ? "Success:" : "Info:"}
              </span>
              <span>{bannerAlert.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerAlert(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Test Connection Banner Response */}
        {testConnStatus.message && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              testConnStatus.success
                ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
                : "border-amber-500/30 bg-amber-950/30 text-amber-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{testConnStatus.message}</span>
              <button
                type="button"
                onClick={() => setTestConnStatus({ loading: false })}
                className="text-xs opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Top Workflow Modes Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                mode === "quick"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Quick Paste Numbers</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("csv")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                mode === "csv"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Personalized CSV Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("single_test")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                mode === "single_test"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Single Test SMS</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 pr-2">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              Jazz / Zong / Ufone / Telenor / SCOM
            </span>
          </div>
        </div>

        {/* 2-Column Grid: Inputs & Validator (Left) / Composer & Phone Screen Mockup (Right) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: Inputs & Pakistan Number Engine (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Quick Numbers Mode */}
            {mode === "quick" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Paste Pakistan Phone Numbers</h2>
                    <p className="text-xs text-slate-400">
                      Enter Pakistani numbers in any format (03001234567, 0300-1234567, or +92300...). Foreign and landlines are auto-excluded.
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-mono text-emerald-400">
                    {quickParsedBatch.valid.length} Valid PK
                  </span>
                </div>

                <textarea
                  value={quickNumbersRaw}
                  onChange={(e) => setQuickNumbersRaw(e.target.value)}
                  rows={6}
                  placeholder="Paste Pakistani numbers here (one per line, or comma separated)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                {/* Operator Stats Pill Bar */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Detected:</span>
                  {(["Jazz", "Zong", "Ufone", "Telenor", "SCOM"] as PakistanOperator[]).map((op) => {
                    const count = quickParsedBatch.operatorStats[op] || 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={op}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border ${getOperatorBadge(
                          op
                        )}`}
                      >
                        <span className="font-bold">{op}:</span> {count}
                      </span>
                    );
                  })}
                  {quickParsedBatch.duplicatesCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
                      {quickParsedBatch.duplicatesCount} Duplicates Skipped
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CSV Mode */}
            {mode === "csv" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">CSV Data with Pakistan Numbers</h2>
                    <p className="text-xs text-slate-400">
                      Requires a <code>phone</code> column. Other columns like <code>name</code>, <code>order_id</code>, <code>url</code> become template variables.
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-mono text-emerald-400">
                    {csvParsed.valid.length} Valid Rows
                  </span>
                </div>

                <textarea
                  value={csvRaw}
                  onChange={(e) => setCsvRaw(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                {csvParsed.errors.length > 0 && (
                  <p className="mt-2 text-xs text-rose-400">{csvParsed.errors.join(", ")}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Available variables:</span>
                  {csvParsed.headers.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setTemplateText((prev) => `${prev} {${h}}`)}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-emerald-300 hover:bg-slate-700 transition"
                    >
                      {"{" + h + "}"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single Test Mode */}
            {mode === "single_test" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                <h2 className="text-sm font-bold text-white">Direct Test SMS</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Send a single test message to your personal Pakistan number to verify gateway connection and link clickability before running bulk campaigns.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300">Recipient Pakistan Phone Number</label>
                    <input
                      type="text"
                      value={singlePhone}
                      onChange={(e) => setSinglePhone(e.target.value)}
                      placeholder="e.g. 03001234567 or +923001234567"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {singlePhoneCheck && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        {singlePhoneCheck.isValid ? (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            ✓ Valid {singlePhoneCheck.operator} ({singlePhoneCheck.e164})
                          </span>
                        ) : (
                          <span className="text-rose-400">✕ {singlePhoneCheck.reason}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300">Test Message with URL</label>
                    <textarea
                      value={singleText}
                      onChange={(e) => setSingleText(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendSingleTest}
                    disabled={sending || !singlePhoneCheck?.isValid}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? "Sending Test SMS..." : "Send Test SMS to Pakistan Number"}
                  </button>
                </div>
              </div>
            )}

            {/* Strict Pakistan Phone Verification Review Panel */}
            {mode !== "single_test" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
                {/* Tabs: Valid vs Excluded */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("valid")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "valid"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        Valid Pakistan ({mode === "quick" ? quickParsedBatch.valid.length : csvParsed.valid.length})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("excluded")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "excluded"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>
                        Excluded Numbers ({mode === "quick" ? quickParsedBatch.excluded.length : csvParsed.excluded.length})
                      </span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500">Auto-formatted to E.164</span>
                </div>

                {/* Table Content */}
                <div className="mt-3 max-h-56 overflow-y-auto">
                  {activeTab === "valid" ? (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-900 text-slate-400">
                        <tr>
                          <th className="py-1.5 px-2 font-medium">E.164 (+92)</th>
                          <th className="py-1.5 px-2 font-medium">Local (03xx)</th>
                          <th className="py-1.5 px-2 font-medium">Network Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {(mode === "quick"
                          ? quickParsedBatch.valid
                          : csvParsed.valid.map((v) => ({
                              e164: v.phone,
                              national: v._national,
                              operator: v._operator as PakistanOperator,
                            }))
                        ).map((v, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-1.5 px-2 text-emerald-400 font-semibold">{v.e164}</td>
                            <td className="py-1.5 px-2 text-slate-300">{v.national || "—"}</td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border ${getOperatorBadge(
                                  v.operator
                                )}`}
                              >
                                {v.operator || "Unknown"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(mode === "quick" ? quickParsedBatch.valid.length : csvParsed.valid.length) === 0 && (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-xs text-slate-500">
                              No valid Pakistan numbers entered yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-900 text-slate-400">
                        <tr>
                          <th className="py-1.5 px-2 font-medium">Excluded Input</th>
                          <th className="py-1.5 px-2 font-medium">Reason for Exclusion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(mode === "quick" ? quickParsedBatch.excluded : csvParsed.excluded).map((exc, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-1.5 px-2 font-mono text-rose-400">{exc.raw}</td>
                            <td className="py-1.5 px-2 text-slate-400">{exc.reason}</td>
                          </tr>
                        ))}
                        {(mode === "quick" ? quickParsedBatch.excluded.length : csvParsed.excluded.length) === 0 && (
                          <tr>
                            <td colSpan={2} className="py-4 text-center text-xs text-slate-500">
                              No excluded numbers! All entries are valid Pakistani mobile numbers.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Composer, URL Tools & Live Phone Mockup (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Message Composer & URL Tools */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-sm font-bold text-white">Message Composer & URL Tools</h2>
                <span className="text-[11px] text-slate-400">Text & Links</span>
              </div>

              {/* URL Quick-Insert Actions */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => insertUrlToComposer("https://yourlink.pk/promo")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-slate-700 transition"
                >
                  + Web Link
                </button>
                <button
                  type="button"
                  onClick={() => insertUrlToComposer("https://wa.me/923001234567")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-slate-700 transition"
                >
                  + WhatsApp Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = mode === "quick" ? messageText : templateText;
                    const urls = extractUrls(text);
                    if (urls.length > 0) {
                      const tagged = appendUtmTags(urls[0], { source: "sms", campaign: "pakistan_promo" });
                      if (mode === "quick") setMessageText((p) => p.replace(urls[0], tagged));
                      else setTemplateText((p) => p.replace(urls[0], tagged));
                    }
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-teal-300 hover:bg-slate-700 transition"
                >
                  + UTM Campaign Tags
                </button>
              </div>

              {/* Preset Templates Dropdown */}
              <div className="mb-3">
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      if (mode === "quick") setMessageText(val);
                      else setTemplateText(val);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose a pre-built template with URL...
                  </option>
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.name} value={tmpl.text}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea */}
              <textarea
                value={mode === "quick" ? messageText : templateText}
                onChange={(e) => {
                  if (mode === "quick") setMessageText(e.target.value);
                  else setTemplateText(e.target.value);
                }}
                rows={4}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Type your SMS message with text and URLs..."
              />

              {/* Segment & Character Metrics */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-xs">
                <div>
                  <span className="font-semibold text-white">{smsAttributes.charCount}</span> chars &bull;{" "}
                  <span className="text-emerald-400 font-semibold">{smsAttributes.segments} segment{smsAttributes.segments > 1 ? "s" : ""}</span>
                  <span className="text-slate-500"> ({smsAttributes.remainingInCurrentSegment} left)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${smsAttributes.hasUnicode ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                    {smsAttributes.encoding}
                  </span>
                </div>
              </div>

              {/* Detected URLs chip bar */}
              {smsAttributes.detectedUrls.length > 0 && (
                <div className="mt-3 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Detected Clickable URLs:</span>
                  <div className="space-y-1">
                    {smsAttributes.detectedUrls.map((url, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-900 px-2.5 py-1 text-xs">
                        <span className="truncate text-emerald-400 font-mono">{url}</span>
                        <a
                          href={ensureHttpUrl(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-teal-300 underline hover:text-teal-200 ml-2"
                        >
                          Test Link ↗
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Smartphone Mockup */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3">
                <span className="text-xs font-semibold text-slate-400">Smartphone Preview</span>
                <span className="text-[11px] text-slate-500">Recipient Phone Display</span>
              </div>

              {/* Mobile Phone Mockup Body */}
              <div className="mx-auto w-full max-w-[280px] rounded-[32px] border-4 border-slate-700 bg-slate-900 p-2 shadow-2xl">
                {/* Speaker notch */}
                <div className="mx-auto mb-2 h-3 w-16 rounded-full bg-slate-800"></div>

                {/* Screen */}
                <div className="rounded-[22px] bg-slate-950 p-3 min-h-[220px] flex flex-col justify-between border border-slate-800">
                  {/* Message header */}
                  <div className="border-b border-slate-800 pb-2 text-center">
                    <div className="text-[11px] font-semibold text-slate-300">
                      {mode === "quick" ? quickParsedBatch.valid[0]?.e164 || "+92 300 1234567" : "+92 300 1234567"}
                    </div>
                    <div className="text-[9px] text-emerald-400">
                      SMS &bull; {mode === "quick" ? quickParsedBatch.valid[0]?.operator || "Jazz" : "Jazz"}
                    </div>
                  </div>

                  {/* Incoming Chat Bubble */}
                  <div className="my-3 self-start rounded-2xl rounded-tl-sm bg-slate-800 p-2.5 text-xs text-slate-200 shadow-sm max-w-[90%]">
                    <p className="whitespace-pre-wrap leading-relaxed text-[11px]">
                      {currentComposerText || "Type your message above to see preview..."}
                    </p>
                    {smsAttributes.detectedUrls.length > 0 && (
                      <div className="mt-1.5 rounded-lg border border-slate-700 bg-slate-900/80 p-1.5 text-[10px]">
                        <span className="block truncate text-emerald-400 font-semibold">
                          🔗 {smsAttributes.detectedUrls[0]}
                        </span>
                        <span className="text-[9px] text-slate-400">Click to open destination link</span>
                      </div>
                    )}
                    <span className="mt-1 block text-right text-[8px] text-slate-500">Now &bull; Delivered</span>
                  </div>

                  {/* Home indicator bar */}
                  <div className="mx-auto h-1 w-16 rounded-full bg-slate-700"></div>
                </div>
              </div>
            </div>

            {/* Campaign Execution Controls */}
            {mode !== "single_test" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Broadcast Controls</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Delay:</span>
                    <select
                      value={delayMs}
                      onChange={(e) => setDelayMs(Number(e.target.value))}
                      className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-200 border border-slate-800"
                    >
                      <option value={100}>100ms (Fast)</option>
                      <option value={250}>250ms (Normal)</option>
                      <option value={500}>500ms (Safe)</option>
                      <option value={1000}>1000ms (Cellular Protected)</option>
                    </select>
                  </div>
                </div>

                {!sending ? (
                  <button
                    type="button"
                    onClick={handleBulkSend}
                    disabled={
                      (mode === "quick" ? quickParsedBatch.valid.length === 0 : csvParsed.valid.length === 0) ||
                      !currentComposerText.trim()
                    }
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Bulk SMS Send ({mode === "quick" ? quickParsedBatch.valid.length : csvParsed.valid.length} Recipients)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>
                        Sending: {progress.done} / {progress.total}
                      </span>
                      <span className="font-semibold text-emerald-400">
                        {Math.round((progress.done / (progress.total || 1)) * 100)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${Math.round((progress.done / (progress.total || 1)) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePauseToggle}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                      >
                        {isPaused ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 rounded-lg border border-rose-500/30 bg-rose-950/30 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Campaign Results & Delivery Table */}
        {rows.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Campaign Delivery Log</h3>
                <p className="text-xs text-slate-400">
                  Total: {rows.length} &bull; Queued: {rows.filter((r) => r.status === "queued").length} &bull; Failed:{" "}
                  {rows.filter((r) => r.status === "failed").length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter by Operator */}
                <select
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
                >
                  <option value="ALL">All Pakistan Operators</option>
                  <option value="Jazz">Jazz</option>
                  <option value="Zong">Zong</option>
                  <option value="Ufone">Ufone</option>
                  <option value="Telenor">Telenor</option>
                  <option value="SCOM">SCOM</option>
                </select>

                {/* Export CSV */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="py-2 px-3 font-medium">Recipient</th>
                    <th className="py-2 px-3 font-medium">Operator</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Message ID / State</th>
                    <th className="py-2 px-3 font-medium">Message Preview</th>
                    <th className="py-2 px-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedResults.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 font-semibold text-slate-200">
                        {row.phone}
                        {row.nationalPhone && (
                          <span className="block text-[10px] text-slate-400 font-normal">{row.nationalPhone}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border ${getOperatorBadge(
                            row.operator
                          )}`}
                        >
                          {row.operator || "Unknown"}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            row.status === "queued"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : row.status === "delivered"
                              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                              : row.status === "failed"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.error && <span className="block text-[10px] text-rose-400 font-sans mt-0.5">{row.error}</span>}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-300">
                        <span className="font-mono text-emerald-300">{row.id || "—"}</span>
                        {row.state && <span className="block text-[10px] text-slate-400 font-sans">{row.state}</span>}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-300 max-w-xs truncate">{row.text}</td>
                      <td className="py-2 px-3 text-right font-sans">
                        {row.id ? (
                          <button
                            type="button"
                            onClick={() => handleCheckStatus(row.id!, i)}
                            className="rounded bg-slate-800 px-2 py-1 text-[10px] text-teal-300 hover:bg-slate-700 transition"
                          >
                            Check Status
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Gateway Configuration Drawer / Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">sms-gate.app Gateway Settings</h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {envLoaded && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-emerald-300">
                  <div className="font-semibold">✓ Environment Credentials Detected</div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Username: <span className="font-mono text-emerald-400">{maskedEnvUser}</span>. You can leave fields below blank to use your .env values, or override them for this session.
                  </p>
                </div>
              )}

              <div>
                <label className="font-medium text-slate-300">Gateway API Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  placeholder="https://api.sms-gate.app/3rdparty/v1"
                />
                <span className="text-[10px] text-slate-500">
                  Default Cloud Server is <code>https://api.sms-gate.app/3rdparty/v1</code>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-300">Username / Login</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                    placeholder={envLoaded ? "Using .env (leave blank)" : "e.g. A3KUT3"}
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-300">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                    placeholder={envLoaded ? "Using .env (leave blank)" : "Gateway password"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-300">Device ID (Optional)</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. qXyoZUBLN..."
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-300">SIM Slot (1 or 2)</label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={simNumber}
                    onChange={(e) => setSimNumber(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={withDeliveryReport}
                  onChange={(e) => setWithDeliveryReport(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0"
                />
                <span>Request Delivery Report from Gateway</span>
              </label>

              {/* In-Modal Connection Test */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testConnStatus.loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  {testConnStatus.loading ? "Connecting to sms-gate.app..." : "Verify Connection"}
                </button>
                {testConnStatus.message && (
                  <p
                    className={`mt-2 rounded-lg p-2 text-[11px] ${
                      testConnStatus.success
                        ? "bg-emerald-950/40 text-emerald-300"
                        : "bg-rose-950/40 text-rose-300"
                    }`}
                  >
                    {testConnStatus.message}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}