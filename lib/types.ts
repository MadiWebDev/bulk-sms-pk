import { PakistanOperator } from "./pakistan-phone";

export type MessageStatus = "pending" | "sending" | "queued" | "delivered" | "failed";

export interface MessageRecord {
  id: string;
  phone: string;
  nationalPhone?: string;
  operator?: PakistanOperator;
  text: string;
  status: MessageStatus;
  gatewayId?: string;
  error?: string;
  timestamp: string;
  campaignId?: string;
  campaignTitle?: string;
  simNumber?: number;
}

export interface CampaignRecord {
  id: string;
  title: string;
  createdAt: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  deliveredCount?: number;
  operatorStats: Record<string, number>;
  status: "completed" | "in_progress" | "cancelled" | "failed";
  textTemplate: string;
  simNumber?: number;
}

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  nationalPhone: string;
  operator: PakistanOperator;
  group: string;
  notes?: string;
  createdAt: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  category: "promotional" | "support" | "alerts" | "transactional" | "custom";
  text: string;
  variables: string[];
  isPreset?: boolean;
}

export interface GatewayConfig {
  username: string;
  password?: string;
  baseUrl: string;
  deviceId?: string;
  simNumber: number;
}

export interface ToastItem {
  id: string;
  type: "success" | "danger" | "warning" | "info";
  title?: string;
  message: string;
  durationMs: number;
}
