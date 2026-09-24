"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  GatewayConfig,
  ToastItem,
  MessageRecord,
  CampaignRecord,
  ContactRecord,
  TemplateRecord,
} from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

interface SmsContextType {
  // Active Gateway Credential (Each credential has its own contacts & history)
  activeGatewayUsername: string;
  savedGateways: GatewayConfig[];
  setActiveGatewayUsername: (username: string) => void;
  deleteSavedGateway: (username: string) => Promise<void>;

  // Gateway Settings Form & Active State
  gatewayConfig: GatewayConfig;
  setGatewayConfig: (config: GatewayConfig) => void;
  saveGatewayConfig: (config: GatewayConfig) => Promise<{ ok: boolean; message: string; error?: string }>;
  envLoaded: boolean;
  maskedEnvUser: string;
  hasEnvCredentials: boolean;

  // Live Gateway Status
  isGatewayOnline: boolean | null;
  gatewayLatency: number | null;
  isCheckingGateway: boolean;
  testGatewayConnection: (customConfig?: GatewayConfig) => Promise<{ ok: boolean; message: string }>;

  // MongoDB Status
  isMongoConnected: boolean;
  mongoStats: { messages: number; campaigns: number; contacts: number; templates: number } | null;
  checkMongoStatus: () => Promise<void>;

  // Toasts
  toasts: ToastItem[];
  showToast: (type: "success" | "danger" | "warning" | "info" | "error", message: string, title?: string) => void;
  removeToast: (id: string) => void;

  // Stored Data (Scoped to the active Gateway Credential)
  messages: MessageRecord[];
  addMessages: (newMessages: MessageRecord[]) => Promise<void>;
  updateMessageStatus: (id: string, status: MessageRecord["status"], state?: string) => void;
  clearMessages: (campaignId?: string) => Promise<void>;
  refreshMessages: (targetUsername?: string) => Promise<void>;

  campaigns: CampaignRecord[];
  addCampaign: (campaign: CampaignRecord) => Promise<void>;
  refreshCampaigns: (targetUsername?: string) => Promise<void>;

  contacts: ContactRecord[];
  contactGroups: string[];
  addContacts: (newContacts: ContactRecord[]) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  refreshContacts: (targetUsername?: string) => Promise<void>;

  templates: TemplateRecord[];
  addTemplate: (tpl: TemplateRecord) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;
  reseedTemplates: () => Promise<void>;
}

const SmsContext = createContext<SmsContextType | undefined>(undefined);

export function SmsProvider({ children }: { children: React.ReactNode }) {
  // Active Gateway Credential Identifier
  const [activeGatewayUsername, setActiveGatewayUsernameState] = useState<string>("");
  const [savedGateways, setSavedGateways] = useState<GatewayConfig[]>([]);

  // Current active Gateway Config
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
    username: "",
    password: "",
    baseUrl: "https://api.sms-gate.app/3rdparty/v1",
    deviceId: "",
    simNumber: 1,
  });

  const [envLoaded, setEnvLoaded] = useState(false);
  const [maskedEnvUser, setMaskedEnvUser] = useState("");
  const [hasEnvCredentials, setHasEnvCredentials] = useState(false);

  // Statuses
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean | null>(null);
  const [gatewayLatency, setGatewayLatency] = useState<number | null>(null);
  const [isCheckingGateway, setIsCheckingGateway] = useState(false);

  const [isMongoConnected, setIsMongoConnected] = useState(false);
  const [mongoStats, setMongoStats] = useState<{
    messages: number;
    campaigns: number;
    contacts: number;
    templates: number;
  } | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Gateway Scoped State
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>(DEFAULT_TEMPLATES);

  // Toast dispatcher
  const showToast = useCallback(
    (
      type: "success" | "danger" | "warning" | "info" | "error",
      message: string,
      title?: string
    ) => {
      const normalizedType = type === "error" ? "danger" : type;
      const durationMs = normalizedType === "danger" ? 5000 : 3500;
      const id = Math.random().toString(36).substring(2, 9) + Date.now();

      const newToast: ToastItem = {
        id,
        type: normalizedType,
        title: title || (normalizedType === "danger" ? "Notice" : normalizedType === "success" ? "Success" : "Info"),
        message,
        durationMs,
      };

      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Check MongoDB status
  const checkMongoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/db/status", { cache: "no-store" });
      const data = await res.json();
      if (data.connected) {
        setIsMongoConnected(true);
        if (data.stats) setMongoStats(data.stats);
      } else {
        setIsMongoConnected(false);
      }
    } catch {
      setIsMongoConnected(false);
    }
  }, []);

  // Refresh messages scoped to the active gateway credential
  const refreshMessages = useCallback(async (targetUsername?: string) => {
    const gw = targetUsername !== undefined ? targetUsername : activeGatewayUsername;
    try {
      const query = gw ? `?gatewayUsername=${encodeURIComponent(gw)}&limit=200` : "?limit=200";
      const res = await fetch(`/api/messages${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          if (typeof window !== "undefined" && gw) {
            localStorage.setItem(`smsgate_pro_messages_v2_${gw}`, JSON.stringify(data.messages));
          }
        }
      }
    } catch {
      // Kept local
    }
  }, [activeGatewayUsername]);

  // Refresh contacts scoped to the active gateway credential
  const refreshContacts = useCallback(async (targetUsername?: string) => {
    const gw = targetUsername !== undefined ? targetUsername : activeGatewayUsername;
    try {
      const query = gw ? `?gatewayUsername=${encodeURIComponent(gw)}` : "";
      const res = await fetch(`/api/contacts${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.contacts)) {
          setContacts(data.contacts);
          if (typeof window !== "undefined" && gw) {
            localStorage.setItem(`smsgate_pro_contacts_v2_${gw}`, JSON.stringify(data.contacts));
          }
        }
      }
    } catch {
      // Kept local
    }
  }, [activeGatewayUsername]);

  // Refresh campaigns scoped to the active gateway credential
  const refreshCampaigns = useCallback(async (targetUsername?: string) => {
    const gw = targetUsername !== undefined ? targetUsername : activeGatewayUsername;
    try {
      const query = gw ? `?gatewayUsername=${encodeURIComponent(gw)}` : "";
      const res = await fetch(`/api/campaigns${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
          if (typeof window !== "undefined" && gw) {
            localStorage.setItem(`smsgate_pro_campaigns_v2_${gw}`, JSON.stringify(data.campaigns));
          }
        }
      }
    } catch {
      // Kept local
    }
  }, [activeGatewayUsername]);

  // Refresh templates
  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
      }
    } catch {
      // Local
    }
  }, []);

  // Fetch gateway configs from server
  const loadGatewayConfigs = useCallback(async (preferredUsername?: string) => {
    try {
      const query = preferredUsername ? `?username=${encodeURIComponent(preferredUsername)}` : "";
      const res = await fetch(`/api/sms/config${query}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.savedGateways)) {
          setSavedGateways(data.savedGateways);
        }

        if (data.activeGateway) {
          const active = data.activeGateway;
          setGatewayConfig({
            username: active.username || "",
            password: active.password || "",
            baseUrl: active.baseUrl || "https://api.sms-gate.app/3rdparty/v1",
            deviceId: active.deviceId || "",
            simNumber: active.simNumber || 1,
            isVerified: active.isVerified ?? false,
            name: active.name,
          });

          setActiveGatewayUsernameState(active.username || "");
          if (active.maskedUsername) {
            setMaskedEnvUser(active.maskedUsername);
            setHasEnvCredentials(Boolean(data.isConfigured));
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setEnvLoaded(true);
    }
  }, []);

  // Switch Active Gateway Credential
  const setActiveGatewayUsername = useCallback(
    (username: string) => {
      setActiveGatewayUsernameState(username);
      if (typeof window !== "undefined") {
        localStorage.setItem("smsgate_active_gateway_username", username);
      }

      // Find config in savedGateways or fetch from server
      const found = savedGateways.find((g) => g.username === username);
      if (found) {
        setGatewayConfig((prev) => ({
          ...prev,
          username: found.username,
          baseUrl: found.baseUrl,
          deviceId: found.deviceId || "",
          simNumber: found.simNumber || 1,
          isVerified: found.isVerified,
          name: found.name,
        }));
      }

      // Re-load data for this specific gateway credential
      loadGatewayConfigs(username);
      refreshContacts(username);
      refreshMessages(username);
      refreshCampaigns(username);
    },
    [savedGateways, loadGatewayConfigs, refreshContacts, refreshMessages, refreshCampaigns]
  );

  // Delete a saved gateway credential
  const deleteSavedGateway = useCallback(
    async (username: string) => {
      try {
        const res = await fetch(`/api/sms/config?username=${encodeURIComponent(username)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setSavedGateways((prev) => prev.filter((g) => g.username !== username));
          showToast("info", `Gateway credential "${username}" removed from database.`, "Gateway Deleted");
          if (activeGatewayUsername === username) {
            loadGatewayConfigs();
          }
        }
      } catch {
        showToast("danger", "Failed to delete gateway credential.", "Error");
      }
    },
    [activeGatewayUsername, loadGatewayConfigs, showToast]
  );

  // Save Gateway config with test-first requirement
  const saveGatewayConfig = useCallback(
    async (newConfig: GatewayConfig): Promise<{ ok: boolean; message: string; error?: string }> => {
      setIsCheckingGateway(true);

      try {
        // Post to /api/sms/config which tests FIRST before saving to MongoDB
        const res = await fetch("/api/sms/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newConfig),
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          const verifiedConfig: GatewayConfig = {
            ...newConfig,
            isVerified: true,
          };
          setGatewayConfig(verifiedConfig);
          setActiveGatewayUsernameState(newConfig.username);
          setIsGatewayOnline(true);
          setGatewayLatency(data.latency || null);

          if (typeof window !== "undefined") {
            localStorage.setItem("smsgate_active_gateway_username", newConfig.username);
            localStorage.setItem(`smsgate_pro_config_v2_${newConfig.username}`, JSON.stringify(verifiedConfig));
          }

          // Update saved gateways list in local state
          setSavedGateways((prev) => {
            const filtered = prev.filter((g) => g.username !== newConfig.username);
            return [
              {
                username: newConfig.username,
                name: newConfig.name || `Android (${newConfig.username})`,
                baseUrl: newConfig.baseUrl,
                deviceId: newConfig.deviceId,
                simNumber: newConfig.simNumber,
                isVerified: true,
                updatedAt: new Date().toISOString(),
              },
              ...filtered,
            ];
          });

          // Refresh contacts and history for this gateway credential
          refreshContacts(newConfig.username);
          refreshMessages(newConfig.username);
          refreshCampaigns(newConfig.username);

          showToast(
            "success",
            data.message || `Credentials "${newConfig.username}" tested & saved in database!`,
            "Saved & Verified"
          );
          return { ok: true, message: data.message };
        } else {
          setIsGatewayOnline(false);
          const errorText = data.error || "Gateway test failed. Credentials were NOT saved to database.";
          showToast("danger", errorText, "Gateway Test Failed");
          return { ok: false, message: errorText, error: errorText };
        }
      } catch (err: unknown) {
        setIsGatewayOnline(false);
        const errorText = err instanceof Error ? err.message : "Network error testing gateway credentials";
        showToast("danger", errorText, "Connection Error");
        return { ok: false, message: errorText, error: errorText };
      } finally {
        setIsCheckingGateway(false);
      }
    },
    [refreshContacts, refreshMessages, refreshCampaigns, showToast]
  );

  // Test Gateway Connection standalone
  const testGatewayConnection = useCallback(
    async (customConfig?: GatewayConfig): Promise<{ ok: boolean; message: string }> => {
      const cfg = customConfig || gatewayConfig;
      setIsCheckingGateway(true);
      const startTime = performance.now();

      try {
        const res = await fetch("/api/sms/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cfg.username,
            password: cfg.password,
            baseUrl: cfg.baseUrl,
          }),
        });

        const elapsed = Math.round(performance.now() - startTime);
        const data = await res.json();

        if (res.ok && data.ok) {
          setIsGatewayOnline(true);
          setGatewayLatency(elapsed);
          showToast("success", `Gateway response verified (${elapsed}ms)`, "Connected");
          return { ok: true, message: data.message || "Connected successfully" };
        } else {
          setIsGatewayOnline(false);
          setGatewayLatency(null);
          const err = data.error || `HTTP ${res.status}`;
          showToast("danger", err, "Connection Issue");
          return { ok: false, message: err };
        }
      } catch (err: unknown) {
        setIsGatewayOnline(false);
        setGatewayLatency(null);
        const errStr = err instanceof Error ? err.message : "Network failure";
        showToast("danger", errStr, "Connection Failed");
        return { ok: false, message: errStr };
      } finally {
        setIsCheckingGateway(false);
      }
    },
    [gatewayConfig, showToast]
  );

  // Add messages scoped to the active gateway credential
  const addMessages = useCallback(
    async (newMessages: MessageRecord[]) => {
      const gw = activeGatewayUsername || "default";
      const scopedMessages = newMessages.map((m) => ({
        ...m,
        gatewayUsername: m.gatewayUsername || gw,
        userId: m.userId || gw,
      }));

      setMessages((prev) => {
        const combined = [...scopedMessages, ...prev].slice(0, 1000);
        if (typeof window !== "undefined" && gw) {
          localStorage.setItem(`smsgate_pro_messages_v2_${gw}`, JSON.stringify(combined));
        }
        return combined;
      });

      try {
        await fetch(`/api/messages?gatewayUsername=${encodeURIComponent(gw)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gatewayUsername: gw, items: scopedMessages }),
        });
      } catch {
        // Offline fallback
      }
    },
    [activeGatewayUsername]
  );

  const updateMessageStatus = useCallback(
    (id: string, status: MessageRecord["status"], state?: string) => {
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === id ? { ...m, status, error: state || m.error } : m));
        if (typeof window !== "undefined" && activeGatewayUsername) {
          localStorage.setItem(`smsgate_pro_messages_v2_${activeGatewayUsername}`, JSON.stringify(updated));
        }
        return updated;
      });
    },
    [activeGatewayUsername]
  );

  const clearMessages = useCallback(
    async (campaignId?: string) => {
      const gw = activeGatewayUsername;
      setMessages((prev) => {
        const filtered = campaignId ? prev.filter((m) => m.campaignId !== campaignId) : [];
        if (typeof window !== "undefined" && gw) {
          localStorage.setItem(`smsgate_pro_messages_v2_${gw}`, JSON.stringify(filtered));
        }
        return filtered;
      });

      try {
        const query = campaignId
          ? `?gatewayUsername=${encodeURIComponent(gw)}&campaignId=${encodeURIComponent(campaignId)}`
          : `?gatewayUsername=${encodeURIComponent(gw)}`;
        await fetch(`/api/messages${query}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
    },
    [activeGatewayUsername]
  );

  // Add campaign scoped to active gateway
  const addCampaign = useCallback(
    async (campaign: CampaignRecord) => {
      const gw = activeGatewayUsername || "default";
      const scopedCampaign = { ...campaign, gatewayUsername: gw, userId: gw };

      setCampaigns((prev) => {
        const updated = [scopedCampaign, ...prev];
        if (typeof window !== "undefined" && gw) {
          localStorage.setItem(`smsgate_pro_campaigns_v2_${gw}`, JSON.stringify(updated));
        }
        return updated;
      });

      try {
        await fetch(`/api/campaigns?gatewayUsername=${encodeURIComponent(gw)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scopedCampaign),
        });
      } catch {
        // Maintained local
      }
    },
    [activeGatewayUsername]
  );

  // Add contacts scoped to active gateway
  const addContacts = useCallback(
    async (newContacts: ContactRecord[]) => {
      const gw = activeGatewayUsername || "default";
      const scopedContacts = newContacts.map((c) => ({
        ...c,
        gatewayUsername: c.gatewayUsername || gw,
        userId: c.userId || gw,
      }));

      setContacts((prev) => {
        const map = new Map<string, ContactRecord>();
        prev.forEach((c) => map.set(c.phone, c));
        scopedContacts.forEach((c) => map.set(c.phone, c));
        const combined = Array.from(map.values());
        if (typeof window !== "undefined" && gw) {
          localStorage.setItem(`smsgate_pro_contacts_v2_${gw}`, JSON.stringify(combined));
        }
        return combined;
      });

      try {
        await fetch(`/api/contacts?gatewayUsername=${encodeURIComponent(gw)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gatewayUsername: gw, items: scopedContacts }),
        });
      } catch {
        // Local maintained
      }
    },
    [activeGatewayUsername]
  );

  // Delete contact scoped to active gateway
  const deleteContact = useCallback(
    async (id: string) => {
      const gw = activeGatewayUsername;
      setContacts((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (typeof window !== "undefined" && gw) {
          localStorage.setItem(`smsgate_pro_contacts_v2_${gw}`, JSON.stringify(filtered));
        }
        return filtered;
      });

      try {
        await fetch(
          `/api/contacts?id=${encodeURIComponent(id)}&gatewayUsername=${encodeURIComponent(gw)}`,
          { method: "DELETE" }
        );
      } catch {
        /* ignore */
      }
    },
    [activeGatewayUsername]
  );

  // Templates
  const addTemplate = useCallback(async (tpl: TemplateRecord) => {
    setTemplates((prev) => [tpl, ...prev.filter((t) => t.id !== tpl.id)]);
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl),
      });
    } catch {
      // Local
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Local
    }
  }, []);

  const reseedTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates", { method: "PUT" });
      if (res.ok) {
        await refreshTemplates();
        await checkMongoStatus();
        showToast("success", "Templates successfully synced to MongoDB!", "Templates Synced");
      }
    } catch {
      showToast("danger", "Could not connect to sync templates.", "Network Error");
    }
  }, [refreshTemplates, checkMongoStatus, showToast]);

  // Initial load on mount
  useEffect(() => {
    let savedGw = "";
    if (typeof window !== "undefined") {
      try {
        savedGw = localStorage.getItem("smsgate_active_gateway_username") || "";
      } catch {
        /* ignore */
      }
    }
    loadGatewayConfigs(savedGw);
    checkMongoStatus();
    refreshTemplates();
  }, [loadGatewayConfigs, checkMongoStatus, refreshTemplates]);

  // Whenever activeGatewayUsername changes, reload contacts & messages
  useEffect(() => {
    if (activeGatewayUsername) {
      refreshContacts(activeGatewayUsername);
      refreshMessages(activeGatewayUsername);
      refreshCampaigns(activeGatewayUsername);
    }
  }, [activeGatewayUsername, refreshContacts, refreshMessages, refreshCampaigns]);

  const contactGroups = Array.from(new Set(contacts.map((c) => c.group).filter(Boolean)));

  return (
    <SmsContext.Provider
      value={{
        activeGatewayUsername,
        savedGateways,
        setActiveGatewayUsername,
        deleteSavedGateway,
        gatewayConfig,
        setGatewayConfig,
        saveGatewayConfig,
        envLoaded,
        maskedEnvUser,
        hasEnvCredentials,
        isGatewayOnline,
        gatewayLatency,
        isCheckingGateway,
        testGatewayConnection,
        isMongoConnected,
        mongoStats,
        checkMongoStatus,
        toasts,
        showToast,
        removeToast,
        messages,
        addMessages,
        updateMessageStatus,
        clearMessages,
        refreshMessages,
        campaigns,
        addCampaign,
        refreshCampaigns,
        contacts,
        contactGroups,
        addContacts,
        deleteContact,
        refreshContacts,
        templates,
        addTemplate,
        deleteTemplate,
        refreshTemplates,
        reseedTemplates,
      }}
    >
      {children}
    </SmsContext.Provider>
  );
}

export function useSms() {
  const context = useContext(SmsContext);
  if (!context) {
    throw new Error("useSms must be used within an SmsProvider");
  }
  return context;
}
