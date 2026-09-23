"use client";

import { useMemo, useState } from "react";

type Mode = "same" | "personalized";

type RowStatus = "pending" | "queued" | "failed";

interface DisplayRow {
  phone: string;
  text: string;
  status: RowStatus;
  id?: string;
  state?: string;
  error?: string;
}

const PHONE_RE = /^\+?[1-9]\d{6,14}$/; // loose E.164 check

function isGsm7(text: string) {
  // Good-enough check for the common GSM-7 character set.
  const gsm7 =
    /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[~\]|€\n\r]*$/;
  return gsm7.test(text);
}

function segmentInfo(text: string) {
  const gsm = isGsm7(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const len = text.length;
  if (len === 0) return { len, segments: 0, encoding: gsm ? "GSM-7" : "UCS-2" };
  const segments = len <= single ? 1 : Math.ceil(len / multi);
  return { len, segments, encoding: gsm ? "GSM-7" : "UCS-2" };
}

function parsePhoneLines(raw: string) {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const cleaned = line.replace(/[\s()-]/g, "");
      if (PHONE_RE.test(cleaned)) {
        if (!seen.has(cleaned)) {
          seen.add(cleaned);
          valid.push(cleaned);
        }
      } else {
        invalid.push(line);
      }
    });
  return { valid, invalid };
}

interface CsvRow {
  [key: string]: string;
}

function parseCsv(raw: string): { rows: CsvRow[]; headers: string[]; errors: string[] } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) {
    return { rows: [], headers: [], errors: ["Need a header row plus at least one data row"] };
  }
  const headers = lines[0].split(",").map((h) => h.trim());
  if (!headers.includes("phone")) {
    errors.push('CSV header must include a "phone" column');
    return { rows: [], headers, errors };
  }
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    if (cells.length !== headers.length) {
      errors.push(`Line ${i + 1}: expected ${headers.length} columns, got ${cells.length}`);
      continue;
    }
    const row: CsvRow = {};
    headers.forEach((h, idx) => (row[h] = cells[idx]));
    const cleanedPhone = row.phone.replace(/[\s()-]/g, "");
    if (!PHONE_RE.test(cleanedPhone)) {
      errors.push(`Line ${i + 1}: invalid phone "${row.phone}"`);
      continue;
    }
    row.phone = cleanedPhone;
    rows.push(row);
  }
  return { rows, headers, errors };
}

function renderTemplate(template: string, row: CsvRow) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(row, key) ? row[key] : `{${key}}`
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function BulkSmsPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("same");

  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [messageText, setMessageText] = useState("");

  const [csvRaw, setCsvRaw] = useState("phone,name\n+15551234567,Jane\n+15559876543,John");
  const [template, setTemplate] = useState("Hi {name}, this is your message.");

  const [batchSize, setBatchSize] = useState(100);
  const [simNumber, setSimNumber] = useState<string>("");
  const [withDeliveryReport, setWithDeliveryReport] = useState(true);

  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const parsedPhones = useMemo(() => parsePhoneLines(recipientsRaw), [recipientsRaw]);
  const parsedCsv = useMemo(() => parseCsv(csvRaw), [csvRaw]);
  const seg = useMemo(
    () => segmentInfo(mode === "same" ? messageText : template),
    [mode, messageText, template]
  );

  const canSend =
    !sending &&
    username.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "same"
      ? messageText.trim().length > 0 && parsedPhones.valid.length > 0
      : template.trim().length > 0 && parsedCsv.rows.length > 0 && parsedCsv.errors.length === 0);

  async function handleSend() {
    setFormError(null);
    setRows([]);

    if (!username.trim() || !password.trim()) {
      setFormError("Enter the gateway username and password from the sms-gate.app app.");
      return;
    }

    let items: { phoneNumbers: string[]; text: string }[] = [];
    let baseRows: DisplayRow[] = [];

    if (mode === "same") {
      if (parsedPhones.valid.length === 0) {
        setFormError("Add at least one valid phone number.");
        return;
      }
      const batches = chunk(parsedPhones.valid, Math.max(1, batchSize || 100));
      items = batches.map((phones) => ({ phoneNumbers: phones, text: messageText }));
      baseRows = parsedPhones.valid.map((phone) => ({
        phone,
        text: messageText,
        status: "pending",
      }));
    } else {
      if (parsedCsv.errors.length > 0) {
        setFormError("Fix the CSV errors before sending.");
        return;
      }
      if (parsedCsv.rows.length === 0) {
        setFormError("Add at least one recipient row to the CSV.");
        return;
      }
      items = parsedCsv.rows.map((r) => ({
        phoneNumbers: [r.phone],
        text: renderTemplate(template, r),
      }));
      baseRows = parsedCsv.rows.map((r) => ({
        phone: r.phone,
        text: renderTemplate(template, r),
        status: "pending",
      }));
    }

    setRows(baseRows);
    setSending(true);
    setProgress({ done: 0, total: baseRows.length });

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          items,
          simNumber: simNumber.trim() ? Number(simNumber) : undefined,
          withDeliveryReport,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data?.error || `Request failed with HTTP ${res.status}`);
        setSending(false);
        return;
      }

      // Expand item-level results (which may cover a batch of phone numbers)
      // back into one display row per phone number.
      const expanded: DisplayRow[] = [];
      const results: {
        phoneNumbers: string[];
        ok: boolean;
        id?: string;
        state?: string;
        error?: string;
      }[] = data.results;

      let phoneCursor = 0;
      for (const result of results) {
        for (const phone of result.phoneNumbers) {
          const base = baseRows[phoneCursor];
          expanded.push({
            phone,
            text: base?.text ?? "",
            status: result.ok ? "queued" : "failed",
            id: result.id,
            state: result.state,
            error: result.error,
          });
          phoneCursor++;
        }
      }

      setRows(expanded);
      setProgress({ done: expanded.length, total: expanded.length });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unexpected error sending messages");
    } finally {
      setSending(false);
    }
  }

  async function checkStatus(row: DisplayRow, index: number) {
    if (!row.id) return;
    try {
      const res = await fetch("/api/sms/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, id: row.id }),
      });
      const data = await res.json();
      setRows((prev) => {
        const next = [...prev];
        if (!res.ok) {
          next[index] = { ...next[index], error: data?.error || "Status check failed" };
        } else {
          next[index] = { ...next[index], state: data?.state };
        }
        return next;
      });
    } catch (err) {
      setRows((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          error: err instanceof Error ? err.message : "Status check failed",
        };
        return next;
      });
    }
  }

  const sentCount = rows.filter((r) => r.status === "queued").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-slate-900">
      <h1 className="text-2xl font-semibold">Bulk SMS Sender</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sends messages through your{" "}
        <a
          href="https://sms-gate.app/"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline"
        >
          sms-gate.app
        </a>{" "}
        cloud gateway. Requests go through this app&rsquo;s own API route, because the gateway
        API has no CORS headers and can&rsquo;t be called straight from the browser.
      </p>

      {/* Credentials */}
      <section className="mt-8 rounded-lg border border-slate-200 p-4">
        <h2 className="font-medium">Gateway credentials</h2>
        <p className="mt-1 text-xs text-slate-500">
          Found in the SMS Gateway for Android app under Cloud Server (or Local Server) settings.
          Not stored anywhere &mdash; only kept in memory for this session.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. ABC123"
              autoComplete="off"
            />
          </label>
          <label className="text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Gateway password"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            SIM slot (optional)
            <input
              type="number"
              min={1}
              value={simNumber}
              onChange={(e) => setSimNumber(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Leave blank for default"
            />
          </label>
          <label className="mt-1 flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={withDeliveryReport}
              onChange={(e) => setWithDeliveryReport(e.target.checked)}
            />
            Request delivery report
          </label>
        </div>
      </section>

      {/* Mode toggle */}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("same")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            mode === "same" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Same message to all
        </button>
        <button
          type="button"
          onClick={() => setMode("personalized")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            mode === "personalized" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Personalized (CSV)
        </button>
      </div>

      {mode === "same" ? (
        <section className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Recipients (one phone number per line)</label>
            <textarea
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              rows={8}
              placeholder={"+15551234567\n+15559876543"}
              className="mt-1 w-full rounded border border-slate-300 p-3 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-slate-500">
              {parsedPhones.valid.length} valid &middot; {parsedPhones.invalid.length} invalid
              {parsedPhones.invalid.length > 0 && (
                <span className="text-red-600"> ({parsedPhones.invalid.slice(0, 3).join(", ")}{parsedPhones.invalid.length > 3 ? "…" : ""})</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-slate-300 p-3 text-sm"
              placeholder="Type the message to send to everyone..."
            />
            <div className="mt-1 text-xs text-slate-500">
              {seg.len} chars &middot; {seg.encoding} &middot; {seg.segments || 0} segment
              {seg.segments === 1 ? "" : "s"}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Batch size per API call</label>
            <input
              type="number"
              min={1}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="mt-1 w-32 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Numbers are grouped into requests of this size (one gateway message per batch).
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Recipients CSV (first line = header, must include a <code>phone</code> column)
            </label>
            <textarea
              value={csvRaw}
              onChange={(e) => setCsvRaw(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded border border-slate-300 p-3 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-slate-500">
              {parsedCsv.rows.length} valid row{parsedCsv.rows.length === 1 ? "" : "s"}
              {parsedCsv.errors.length > 0 && (
                <span className="text-red-600"> &middot; {parsedCsv.errors.length} error(s): {parsedCsv.errors.slice(0, 3).join("; ")}</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              Message template (use <code>{"{column}"}</code> placeholders)
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-slate-300 p-3 text-sm"
            />
            <div className="mt-1 text-xs text-slate-500">
              {seg.len} chars &middot; {seg.encoding} &middot; {seg.segments || 0} segment
              {seg.segments === 1 ? "" : "s"} (per message, before placeholders are filled in)
            </div>
            {parsedCsv.rows[0] && (
              <p className="mt-1 text-xs text-slate-500">
                Preview: <span className="italic">{renderTemplate(template, parsedCsv.rows[0])}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {formError && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {sending ? `Sending… (${progress.done}/${progress.total})` : "Send bulk SMS"}
      </button>

      {rows.length > 0 && (
        <section className="mt-8">
          <h2 className="font-medium">
            Results &mdash; {sentCount} queued, {failedCount} failed, {rows.length} total
          </h2>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message ID</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Error</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.phone}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono">{row.phone}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          row.status === "queued"
                            ? "text-green-700"
                            : row.status === "failed"
                            ? "text-red-700"
                            : "text-slate-500"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{row.id || "—"}</td>
                    <td className="px-3 py-1.5">{row.state || "—"}</td>
                    <td className="px-3 py-1.5 text-red-600">{row.error || ""}</td>
                    <td className="px-3 py-1.5">
                      {row.id && (
                        <button
                          type="button"
                          onClick={() => checkStatus(row, i)}
                          className="text-xs text-blue-600 underline"
                        >
                          Check status
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}