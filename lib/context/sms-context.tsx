"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GatewayConfig, ToastItem, MessageRecord, CampaignRecord, ContactRecord, TemplateRecord } from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

interface SmsContextType {
  // Gateway Settings
  gatewayConfig: GatewayConfig;
  setGatewayConfig: (config: GatewayConfig) => void;
  saveGatewayConfig: (config: GatewayConfig) => void;
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

  // Stored Data (Synced with DB / localStorage)
  messages: MessageRecord[];
  addMessages: (newMessages: MessageRecord[]) => Promise<void>;
  updateMessageStatus: (id: string, status: MessageRecord["status"], state?: string) => void;
  clearMessages: (campaignId?: string) => Promise<void>;
  refreshMessages: () => Promise<void>;

  campaigns: CampaignRecord[];
  addCampaign: (campaign: CampaignRecord) => Promise<void>;
  refreshCampaigns: () => Promise<void>;

  contacts: ContactRecord[];
  contactGroups: string[];
  addContacts: (newContacts: ContactRecord[]) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  refreshContacts: () => Promise<void>;

  templates: TemplateRecord[];
  addTemplate: (tpl: TemplateRecord) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;
}

const STORAGE_SETTINGS_KEY = "smsgate_pro_config_v2";
const STORAGE_MESSAGES_KEY = "smsgate_pro_messages_v2";
const STORAGE_CAMPAIGNS_KEY = "smsgate_pro_campaigns_v2";
const STORAGE_CONTACTS_KEY = "smsgate_pro_contacts_v2";
const STORAGE_TEMPLATES_KEY = "smsgate_pro_templates_v2";

const SmsContext = createContext<SmsContextType | undefined>(undefined);

export function SmsProvider({ children }: { children: React.ReactNode }) {
  // Gateway config
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

  // Stored state
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
        if (data.stats) {
          setMongoStats(data.stats);
        }
      } else {
        setIsMongoConnected(false);
      }
    } catch {
      setIsMongoConnected(false);
    }
  }, []);

  // Test Gateway Connection
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

  // Load Initial Configuration from Env and Local Storage
  useEffect(() => {
    async function init() {
      // 1. Fetch server env config
      let envCreds = false;
      try {
        const res = await fetch("/api/sms/config");
        if (res.ok) {
          const data = await res.json();
          if (data.isConfigured) {
            envCreds = true;
            setHasEnvCredentials(true);
            setMaskedEnvUser(data.maskedUsername || "");
            setGatewayConfig((prev) => ({
              ...prev,
              username: prev.username || data.maskedUsername || "",
              baseUrl: prev.baseUrl || data.baseUrl,
              deviceId: prev.deviceId || data.deviceId || "",
              simNumber: data.simNumber || 1,
            }));
          }
        }
      } catch {
        // Ignore
      }
      setEnvLoaded(true);

      // 2. Read LocalStorage overrides
      if (typeof window !== "undefined") {
        try {
          const storedCfg = localStorage.getItem(STORAGE_SETTINGS_KEY);
          if (storedCfg) {
            const parsed = JSON.parse(storedCfg);
            setGatewayConfig((prev) => ({ ...prev, ...parsed }));
          }

          const storedMsgs = localStorage.getItem(STORAGE_MESSAGES_KEY);
          if (storedMsgs) setMessages(JSON.parse(storedMsgs));

          const storedCampaigns = localStorage.getItem(STORAGE_CAMPAIGNS_KEY);
          if (storedCampaigns) setCampaigns(JSON.parse(storedCampaigns));

          const storedContacts = localStorage.getItem(STORAGE_CONTACTS_KEY);
          if (storedContacts) setContacts(JSON.parse(storedContacts));

          const storedTpls = localStorage.getItem(STORAGE_TEMPLATES_KEY);
          if (storedTpls) setTemplates(JSON.parse(storedTpls));
        } catch {
          // localStorage error handled
        }
      }

      // 3. Check MongoDB
      await checkMongoStatus();
    }

    init();
  }, [checkMongoStatus]);

  // Persist Gateway config
  const saveGatewayConfig = useCallback((newConfig: GatewayConfig) => {
    setGatewayConfig(newConfig);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(newConfig));
    }
  }, []);

  // Refresh messages from DB or keep local
  const refreshMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?limit=200");
      if (res.ok) {
        const data = await res.json();
        if (data.storage === "mongodb" && Array.isArray(data.messages)) {
          setMessages(data.messages);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(data.messages));
          }
        }
      }
    } catch {
      // Keep local
    }
  }, []);

  // Add messages
  const addMessages = useCallback(
    async (newMessages: MessageRecord[]) => {
      setMessages((prev) => {
        const combined = [...newMessages, ...prev].slice(0, 1000);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(combined));
        }
        return combined;
      });

      // Sync to MongoDB in background
      try {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMessages),
        });
      } catch {
        // Offline fallback maintained
      }
    },
    []
  );

  const updateMessageStatus = useCallback((id: string, status: MessageRecord["status"], state?: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, status, state: state || m.error } : m));
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const clearMessages = useCallback(async (campaignId?: string) => {
    setMessages((prev) => {
      const filtered = campaignId ? prev.filter((m) => m.campaignId !== campaignId) : [];
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(filtered));
      }
      return filtered;
    });

    try {
      const url = campaignId ? `/api/messages?campaignId=${encodeURIComponent(campaignId)}` : "/api/messages";
      await fetch(url, { method: "DELETE" });
    } catch {
      // Handled
    }
  }, []);

  // Campaigns
  const refreshCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        if (data.storage === "mongodb" && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_CAMPAIGNS_KEY, JSON.stringify(data.campaigns));
          }
        }
      }
    } catch {
      // Kept local
    }
  }, []);

  const addCampaign = useCallback(async (campaign: CampaignRecord) => {
    setCampaigns((prev) => {
      const updated = [campaign, ...prev];
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CAMPAIGNS_KEY, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaign),
      });
    } catch {
      // Maintained local
    }
  }, []);

  // Contacts
  const refreshContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        if (data.storage === "mongodb" && Array.isArray(data.contacts)) {
          setContacts(data.contacts);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(data.contacts));
          }
        }
      }
    } catch {
      // Kept local
    }
  }, []);

  const addContacts = useCallback(async (newContacts: ContactRecord[]) => {
    setContacts((prev) => {
      const map = new Map<string, ContactRecord>();
      prev.forEach((c) => map.set(c.phone, c));
      newContacts.forEach((c) => map.set(c.phone, c));
      const combined = Array.from(map.values());
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(combined));
      }
      return combined;
    });

    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContacts),
      });
    } catch {
      // Local maintained
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    setContacts((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(filtered));
      }
      return filtered;
    });

    try {
      await fetch(`/api/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Handled
    }
  }, []);

  // Templates
  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(data.templates));
          }
        }
      }
    } catch {
      // Local
    }
  }, []);

  const addTemplate = useCallback(async (tpl: TemplateRecord) => {
    setTemplates((prev) => {
      const filtered = prev.filter((t) => t.id !== tpl.id);
      const updated = [tpl, ...filtered];
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(updated));
      }
      return updated;
    });

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
    setTemplates((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(filtered));
      }
      return filtered;
    });

    try {
      await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Local
    }
  }, []);

  const contactGroups = Array.from(new Set(contacts.map((c) => c.group).filter(Boolean)));

  return (
    <SmsContext.Provider
      value={{
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
