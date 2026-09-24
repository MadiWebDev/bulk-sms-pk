"use client";

import { useState } from "react";
import { useSms } from "@/lib/context/sms-context";
import { GatewayConfig } from "@/lib/types";
import {
  Settings,
  Radio,
  Database,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  Info,
} from "lucide-react";

export default function ConnectionPage() {
  const {
    gatewayConfig,
    saveGatewayConfig,
    isGatewayOnline,
    gatewayLatency,
    isCheckingGateway,
    testGatewayConnection,
    isMongoConnected,
    mongoStats,
    checkMongoStatus,
    showToast,
    messages,
    contacts,
    campaigns,
    templates,
  } = useSms();

  // Form state for Gateway
  const [username, setUsername] = useState(gatewayConfig.username || "");
  const [password, setPassword] = useState(gatewayConfig.password || "");
  const [baseUrl, setBaseUrl] = useState(
    gatewayConfig.baseUrl || "https://api.sms-gate.app/3rdparty/v1"
  );
  const [deviceId, setDeviceId] = useState(gatewayConfig.deviceId || "");
  const [simNumber, setSimNumber] = useState<number>(gatewayConfig.simNumber || 1);
  const [showPassword, setShowPassword] = useState(false);

  // Diagnostics test output
  const [diagnosticsResult, setDiagnosticsResult] = useState<{
    ok?: boolean;
    message?: string;
    latency?: number;
  } | null>(null);

  const [isTestingDb, setIsTestingDb] = useState(false);

  // Save Gateway Settings
  const handleSaveGateway = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: GatewayConfig = {
      username: username.trim(),
      password: password.trim(),
      baseUrl: baseUrl.trim() || "https://api.sms-gate.app/3rdparty/v1",
      deviceId: deviceId.trim(),
      simNumber,
    };

    saveGatewayConfig(updated);
    showToast("success", "SMS Gateway connection settings saved locally!", "Settings Saved");
  };

  // Run Gateway Ping & Diagnostics
  const handleRunDiagnostics = async () => {
    const updated: GatewayConfig = {
      username: username.trim(),
      password: password.trim(),
      baseUrl: baseUrl.trim() || "https://api.sms-gate.app/3rdparty/v1",
      deviceId: deviceId.trim(),
      simNumber,
    };

    saveGatewayConfig(updated);
    const start = performance.now();
    const res = await testGatewayConnection(updated);
    const elapsed = Math.round(performance.now() - start);

    setDiagnosticsResult({
      ok: res.ok,
      message: res.message,
      latency: elapsed,
    });
  };

  // Ping MongoDB
  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    await checkMongoStatus();
    setIsTestingDb(false);
    showToast("info", "MongoDB status refreshed.", "Database Check");
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      gatewayConfig: { ...gatewayConfig, password: "" }, // Don't export raw password for safety
      messages,
      campaigns,
      contacts,
      templates,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `bulksms_pk_backup_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("success", "Full application backup exported to JSON.", "Backup Ready");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Settings className="h-3 w-3" />
                Connection & Infrastructure Setup
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Gateway & MongoDB Connection Center
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect your Android phone running sms-gate.app, test live authentication, and configure MongoDB storage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={isCheckingGateway}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition disabled:opacity-60"
            >
              <Radio className={`h-3.5 w-3.5 ${isCheckingGateway ? "animate-pulse" : ""}`} />
              <span>{isCheckingGateway ? "Testing..." : "Test Connection"}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Gateway Settings Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Android Gateway Settings */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  SMS-Gate.app Android Credentials
                </span>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isGatewayOnline === true
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isGatewayOnline === false
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                >
                  {isGatewayOnline === true
                    ? `Gateway Verified (${gatewayLatency}ms)`
                    : isGatewayOnline === false
                      ? "Offline / Bad Auth"
                      : "Not Tested"}
                </span>
              </div>

              <form onSubmit={handleSaveGateway} className="space-y-4 text-xs">
                {/* Username */}
                <div>
                  <label className="text-slate-400 block mb-1">Gateway Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. A1B2C3"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Found in your Android app under Cloud Server &rarr; Login.
                  </span>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Gateway Password</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showPassword ? "Hide" : "Show"}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Android gateway password..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>



                {/* Device ID and SIM Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Device ID </label>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="e.g. G3dhj75T987F3ertfgw&4"
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Required only if multiple phones share the same gateway account.
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Default SIM Card Slot</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSimNumber(1)}
                        className={`flex-1 py-2 rounded-xl font-bold border transition ${simNumber === 1
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                          }`}
                      >
                        SIM 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimNumber(2)}
                        className={`flex-1 py-2 rounded-xl font-bold border transition ${simNumber === 2
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                          }`}
                      >
                        SIM 2
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition shadow-sm"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Gateway Credentials</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Diagnostics Output Card */}
            {diagnosticsResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 ${diagnosticsResult.ok
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                  : "bg-rose-950/30 border-rose-500/30 text-rose-200"
                  }`}
              >
                <div className="flex items-center gap-2">
                  {diagnosticsResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="font-bold text-sm text-white">
                    {diagnosticsResult.ok ? "Gateway Online & Authorized" : "Gateway Connection Issue"}
                  </span>
                </div>
                <p className="leading-relaxed">{diagnosticsResult.message}</p>
                {diagnosticsResult.latency && (
                  <span className="text-[11px] text-slate-400 block">
                    Roundtrip Latency: {diagnosticsResult.latency} ms
                  </span>
                )}
              </div>
            )}

            {/* 2. MongoDB Database Configuration */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-400" />
                  MongoDB Cloud Storage Status
                </span>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isMongoConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                >
                  {isMongoConnected ? "Connected" : "Local Storage Mode"}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {isMongoConnected
                  ? `MongoDB Atlas is connected and active. All sent messages, campaigns, contacts, and custom templates are stored securely in your database.`
                  : `The application is currently running smoothly in Local Storage mode. To enable persistent cloud database synchronization across devices, add your MongoDB connection string in the .env file:`}
              </p>

              {!isMongoConnected && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400/90 overflow-x-auto">
                  <code>
                    # In your project .env file:<br />
                    MONGODB_URI=mongodb+srv://&lt;username&gt;:&lt;password&gt;@cluster0.mongodb.net/bulksms_pakistan
                  </code>
                </div>
              )}

              {isMongoConnected && mongoStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Messages</span>
                    <span className="font-bold text-white">{mongoStats.messages}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Campaigns</span>
                    <span className="font-bold text-white">{mongoStats.campaigns}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Contacts</span>
                    <span className="font-bold text-white">{mongoStats.contacts}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Templates</span>
                    <span className="font-bold text-white">{mongoStats.templates}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={isTestingDb}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTestingDb ? "animate-spin" : ""}`} />
                  <span>{isTestingDb ? "Checking Database..." : "Test Database Connection"}</span>
                </button>
              </div>
            </div>

            {/* 3. System Backup & Export */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-emerald-400" />
                Data Backup & Migration
              </span>

              <p className="text-xs text-slate-400 leading-relaxed">
                Export all your contacts, custom templates, campaign history, and configuration into a portable JSON backup file.
              </p>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Download Full JSON Backup</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Step-by-Step Android Setup Guide (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  Android Phone Setup Guide
                </h3>
                <a
                  href="https://sms-gate.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>sms-gate.app</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Install Android Gateway</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Download and install the APK on an Android device with an active Pakistani SIM card (Jazz, Zong, Telenor, Onic, SCOM or Ufone). SMS Package
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Enable Cloud Server</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Toggle <strong>Cloud Server: ON</strong> in the app. It will display a random Username, Password and Device ID on your phone screen.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Copy Credentials Here</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Paste the exact Login and Password into the form on the left, then click <strong>Test Connection</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Battery Optimization Warning</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      In Android Settings &rarr; Apps &rarr; SMS Gateway, select <strong>Battery &rarr; Unrestricted</strong> so Android doesn&apos;t sleep the gateway service during bulk campaigns.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Local Wi-Fi Mode:</strong> If your PC and phone are on the same Wi-Fi network, you can also use Local Server mode (`http://192.168.x.x:8080`) for zero-internet high-speed dispatch!
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
