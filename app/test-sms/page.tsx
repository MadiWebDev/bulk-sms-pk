"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSms } from "@/lib/context/sms-context";
import { validatePakistanPhone } from "@/lib/pakistan-phone";
import { calculateSMSAttributes, buildWhatsAppLink, appendUtmTags } from "@/lib/sms-text";
import { OperatorBadge } from "@/components/operator-badge";
import { PhonePreview } from "@/components/phone-preview";
import { StatusBadge } from "@/components/status-badge";
import {
  Zap,
  Send,
  Smartphone,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Link as LinkIcon,
  MessageSquare,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

function TestSmsInner() {
  const { gatewayConfig, addMessages, showToast, isGatewayOnline, testGatewayConnection, templates } = useSms();
  const searchParams = useSearchParams();

  // Recipient input
  const [phoneNumber, setPhoneNumber] = useState("");
  // Message input
  const [messageText, setMessageText] = useState(
    "Salam! Exclusive discount: Enjoy FLAT 25% OFF on all items today only. Order now: https://store.pk/sale?utm_source=sms Code: PK25. Free delivery across Pakistan!"
  );
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);

  const [selectedSim, setSelectedSim] = useState<number>(gatewayConfig.simNumber || 1);
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // Pre-fill template from URL ?templateId=...
  useEffect(() => {
    const templateId = searchParams.get("templateId");
    if (templateId && templates.length > 0) {
      const found = templates.find((t) => t.id === templateId);
      if (found) {
        setMessageText(found.text);
        setLoadedTemplateName(found.name);
        showToast("info", `Template "${found.name}" loaded into Test SMS.`, "Template Loaded");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  // Link & UTM generator modal/helper
  const [showUtmHelper, setShowUtmHelper] = useState(false);
  const [utmUrl, setUtmUrl] = useState("https://mystore.pk/shop");
  const [utmSource, setUtmSource] = useState("bulksms");
  const [utmCampaign, setUtmCampaign] = useState("flash_sale");

  // WhatsApp link helper
  const [showWaHelper, setShowWaHelper] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [waPrefill, setWaPrefill] = useState("Salam! I want to inquire about my order.");

  // Validation
  const phoneValidation = useMemo(() => {
    return validatePakistanPhone(phoneNumber);
  }, [phoneNumber]);

  // SMS Text Attributes
  const smsAttrs = useMemo(() => {
    return calculateSMSAttributes(messageText);
  }, [messageText]);

  // Handle Send Test SMS
  const handleSendTest = async () => {
    if (!phoneValidation.isValid || !phoneValidation.e164) {
      showToast("danger", phoneValidation.reason || "Please enter a valid Pakistani mobile number (03xx / +923xx).", "Invalid Phone");
      return;
    }

    if (!messageText.trim()) {
      showToast("warning", "Message content cannot be empty.", "Empty Message");
      return;
    }

    setIsSending(true);
    setLastResponse(null);

    try {
      const payload = {
        username: gatewayConfig.username,
        password: gatewayConfig.password,
        baseUrl: gatewayConfig.baseUrl,
        deviceId: gatewayConfig.deviceId,
        simNumber: selectedSim,
        withDeliveryReport: true,
        items: [
          {
            phoneNumbers: [phoneValidation.e164],
            text: messageText,
          },
        ],
      };

      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setLastResponse(data);

      const firstResult = data.results?.[0];

      if (res.ok && firstResult?.ok) {
        showToast("success", `SMS dispatched to ${phoneValidation.e164} via SIM ${selectedSim}!`, "Test Message Sent");

        // Record in history log
        addMessages([
          {
            id: firstResult.id || `test_${Date.now()}`,
            phone: phoneValidation.e164,
            nationalPhone: phoneValidation.national,
            operator: phoneValidation.operator,
            text: messageText,
            status: "queued",
            gatewayId: firstResult.id,
            timestamp: new Date().toISOString(),
            simNumber: selectedSim,
            campaignTitle: "Single Test SMS",
          },
        ]);
      } else {
        const errorText = firstResult?.error || data.error || `HTTP ${res.status}`;
        showToast("danger", errorText, "Gateway Error");

        addMessages([
          {
            id: `test_err_${Date.now()}`,
            phone: phoneValidation.e164,
            nationalPhone: phoneValidation.national,
            operator: phoneValidation.operator,
            text: messageText,
            status: "failed",
            error: errorText,
            timestamp: new Date().toISOString(),
            simNumber: selectedSim,
            campaignTitle: "Single Test SMS",
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error contacting SMS gateway";
      showToast("danger", msg, "Network Error");
      setLastResponse({ error: msg });
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyUtm = () => {
    const tagged = appendUtmTags(utmUrl, { source: utmSource, campaign: utmCampaign });
    setMessageText((prev) => `${prev} ${tagged}`);
    setShowUtmHelper(false);
    showToast("info", "UTM tracked link added to message", "Link Inserted");
  };

  const handleApplyWhatsApp = () => {
    const link = buildWhatsAppLink(waNumber, waPrefill);
    setMessageText((prev) => `${prev} Chat on WhatsApp: ${link}`);
    setShowWaHelper(false);
    showToast("info", "WhatsApp direct link added", "Link Inserted");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="h-3 w-3" />
                Live Single SMS Tester
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Single SMS & Validation Studio
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict Pakistani mobile validation, carrier detection, character count, and real-time smartphone rendering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => testGatewayConnection()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Ping Gateway</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: inputs and controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Recipient Phone Input */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  Pakistani Recipient Number
                </label>
                {phoneValidation.isValid && (
                  <OperatorBadge operator={phoneValidation.operator} />
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="03001234567 or +923001234567"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none transition ${
                    phoneValidation.isValid
                      ? "border-emerald-500/40 bg-slate-950/80 focus:border-emerald-400"
                      : "border-rose-500/40 bg-slate-950/80 focus:border-rose-400"
                  }`}
                />
              </div>

              {/* Real-time validation card */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  phoneValidation.isValid
                    ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-200"
                    : "bg-rose-950/30 border-rose-500/20 text-rose-200"
                }`}
              >
                {phoneValidation.isValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-emerald-300">
                        Valid Pakistan Mobile Number: {phoneValidation.e164}
                      </div>
                      <div className="text-[11px] text-emerald-400/80 mt-0.5">
                        Local Format: {phoneValidation.national} &bull; Network: {phoneValidation.operator} (Prefix: {phoneValidation.operatorPrefix})
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-rose-300">Invalid Pakistani Mobile Number</div>
                      <div className="text-[11px] text-rose-400/80 mt-0.5">
                        {phoneValidation.reason || "Must begin with 03xx or +923xx and be exactly 11 digits."}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 2. Message Content */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  SMS Message Body
                  {loadedTemplateName && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 normal-case tracking-normal">
                      📋 {loadedTemplateName}
                    </span>
                  )}
                </label>

                {/* Helper buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUtmHelper(!showUtmHelper)}
                    className="text-[11px] font-medium text-slate-300 hover:text-emerald-400 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 transition"
                  >
                    <LinkIcon className="h-3 w-3" />
                    UTM Link
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWaHelper(!showWaHelper)}
                    className="text-[11px] font-medium text-slate-300 hover:text-emerald-400 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 transition"
                  >
                    <ExternalLink className="h-3 w-3" />
                    WhatsApp Link
                  </button>
                </div>
              </div>

              {/* UTM Helper Panel */}
              {showUtmHelper && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-bold text-white block">Add Website Link with Tracking</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Target URL"
                      value={utmUrl}
                      onChange={(e) => setUtmUrl(e.target.value)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="utm_source (e.g. sms)"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="utm_campaign"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowUtmHelper(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyUtm}
                      className="px-3 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                    >
                      Insert Link
                    </button>
                  </div>
                </div>
              )}

              {/* WhatsApp Helper Panel */}
              {showWaHelper && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-bold text-white block">Insert WhatsApp Direct Click-to-Chat</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="WhatsApp Mobile (e.g. 03001234567)"
                      value={waNumber}
                      onChange={(e) => setWaNumber(e.target.value)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Pre-filled greeting"
                      value={waPrefill}
                      onChange={(e) => setWaPrefill(e.target.value)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowWaHelper(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyWhatsApp}
                      className="px-3 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                    >
                      Insert WhatsApp URL
                    </button>
                  </div>
                </div>
              )}

              <div>
                <textarea
                  rows={5}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Enter message text here..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition font-sans leading-relaxed"
                />
              </div>

              {/* GSM / Segment Metrics Pill Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Length</span>
                  <span className="font-bold text-slate-200">
                    {smsAttrs.charCount} characters
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SMS Segments</span>
                  <span className="font-bold text-emerald-400">
                    {smsAttrs.segments} {smsAttrs.segments === 1 ? "part" : "parts"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Encoding</span>
                  <span className={`font-semibold ${smsAttrs.hasUnicode ? "text-amber-400" : "text-slate-300"}`}>
                    {smsAttrs.encoding}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Remaining in Segment</span>
                  <span className="font-bold text-slate-300">
                    {smsAttrs.remainingInCurrentSegment}
                  </span>
                </div>
              </div>

              {/* SIM Selection & Send Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-medium">SIM Slot:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSim(1)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                        selectedSim === 1
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      SIM 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSim(2)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                        selectedSim === 2
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      SIM 2
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isSending || !phoneValidation.isValid}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className={`h-4 w-4 ${isSending ? "animate-spin" : ""}`} />
                  <span>{isSending ? "Dispatching to Gateway..." : "Send Test SMS Now"}</span>
                </button>
              </div>
            </div>

            {/* 3. Gateway Diagnostics & Response Inspector */}
            {lastResponse && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="h-4 w-4 text-emerald-400" />
                    Gateway Raw Response Inspector
                  </span>
                  <span className="text-[10px] text-slate-500">Live JSON payload</span>
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-56">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Phone Mockup (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="sticky top-24 w-full flex flex-col items-center">
              <div className="mb-2 text-center">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Live Recipient Simulator
                </h3>
                <p className="text-[11px] text-slate-500">Real-time Pakistani mobile view</p>
              </div>

              <PhonePreview
                messageText={messageText}
                recipientPhone={phoneValidation.national || phoneNumber}
                operatorName={phoneValidation.operator ? `${phoneValidation.operator} PK` : "Cellular"}
                senderName="Brand Promo"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TestSmsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-slate-400 text-sm">Loading...</div></div>}>
      <TestSmsInner />
    </Suspense>
  );
}

