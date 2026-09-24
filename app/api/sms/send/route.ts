import { NextRequest, NextResponse } from "next/server";
import { validatePakistanPhone } from "@/lib/pakistan-phone";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

interface SendItem {
  phoneNumbers: string[];
  text: string;
}

interface SendRequestBody {
  username?: string;
  password?: string;
  baseUrl?: string;
  deviceId?: string;
  simNumber?: number;
  withDeliveryReport?: boolean;
  ttl?: number; // seconds
  delayMs?: number; // throttling delay between requests
  items: SendItem[];
}

export interface ItemResult {
  phoneNumbers: string[];
  ok: boolean;
  id?: string;
  state?: string;
  status?: number;
  error?: string;
}

const CONCURRENCY = 3; // Keep conservative concurrency to prevent Android service queue saturation

export async function POST(req: NextRequest) {
  let body: SendRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const username = body.username?.trim() || process.env.SMSGATE_USERNAME || "";
  const password = body.password?.trim() || process.env.SMSGATE_PASSWORD || "";
  const baseUrl = (body.baseUrl?.trim() || process.env.SMS_GATE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const deviceId = body.deviceId?.trim() || process.env.SMSGATE_DEVICE_ID || "";
  const simNumber =
    typeof body.simNumber === "number"
      ? body.simNumber
      : Number(process.env.SMSGATE_SIM_NUMBER || "1") || 1;
  const withDeliveryReport = body.withDeliveryReport ?? true;
  const ttl = body.ttl ?? 3600;
  const delayMs = typeof body.delayMs === "number" ? Math.max(0, Math.min(body.delayMs, 5000)) : 200;

  if (!username || !password) {
    return NextResponse.json(
      {
        error:
          "Missing gateway credentials. Provide username & password or configure SMSGATE_USERNAME and SMSGATE_PASSWORD in .env.",
      },
      { status: 400 }
    );
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No messages to send. Recipient list is empty." }, { status: 400 });
  }

  // Pre-validate that all items have valid Pakistan numbers and non-empty text
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.text || !item.text.trim()) {
      return NextResponse.json(
        { error: `Item #${idx + 1}: message text cannot be empty.` },
        { status: 400 }
      );
    }
    if (!Array.isArray(item.phoneNumbers) || item.phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: `Item #${idx + 1}: at least one phone number is required.` },
        { status: 400 }
      );
    }
  }

  const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const results: ItemResult[] = new Array(items.length);

  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];

      // Strict Pakistan verification and sanitization for every recipient
      const validatedPhones: string[] = [];
      const invalidReasons: string[] = [];

      for (const phone of item.phoneNumbers) {
        const check = validatePakistanPhone(phone);
        if (check.isValid && check.e164) {
          validatedPhones.push(check.e164);
        } else {
          invalidReasons.push(`${phone}: ${check.reason || "Invalid Pakistani number"}`);
        }
      }

      if (validatedPhones.length === 0) {
        results[index] = {
          phoneNumbers: item.phoneNumbers,
          ok: false,
          error: `Rejected: No valid Pakistan mobile numbers (${invalidReasons.join("; ")})`,
        };
        continue;
      }

      const payload: Record<string, unknown> = {
        textMessage: { text: item.text.trim() },
        phoneNumbers: validatedPhones,
        withDeliveryReport,
        ttl,
        simNumber,
      };

      if (deviceId) {
        payload.deviceId = deviceId;
      }

      // Throttling delay to prevent cellular queue congestion
      if (delayMs > 0 && index > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      try {
        // Correct endpoint per sms-gate.app specification: /3rdparty/v1/messages
        const res = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          results[index] = {
            phoneNumbers: validatedPhones,
            ok: false,
            status: res.status,
            error:
              (data && (data.message || data.error || data.title)) ||
              `Gateway returned HTTP ${res.status}`,
          };
        } else {
          results[index] = {
            phoneNumbers: validatedPhones,
            ok: true,
            id: data?.id,
            state: data?.state || "Enqueued",
          };
        }
      } catch (err) {
        results[index] = {
          phoneNumbers: validatedPhones,
          ok: false,
          error: err instanceof Error ? err.message : "Network error contacting SMS gateway",
        };
      }
    }
  }

  const poolSize = Math.min(CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  // Asynchronously log to MongoDB if connected
  try {
    const { getDatabase } = await import("@/lib/mongodb");
    const db = await getDatabase();
    if (db) {
      const recordsToInsert: any[] = [];
      const timestamp = new Date().toISOString();

      items.forEach((item, idx) => {
        const res = results[idx];
        const primaryPhone = (res?.phoneNumbers?.[0] || item.phoneNumbers[0] || "");
        const check = validatePakistanPhone(primaryPhone);
        
        recordsToInsert.push({
          id: res?.id || `msg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          phone: check.e164 || primaryPhone,
          nationalPhone: check.national || primaryPhone,
          operator: check.operator || "Unknown",
          text: item.text,
          status: res?.ok ? "queued" : "failed",
          gatewayId: res?.id,
          error: res?.error,
          timestamp,
          campaignId: (body as any).campaignId || undefined,
          campaignTitle: (body as any).campaignTitle || undefined,
          simNumber,
        });
      });

      if (recordsToInsert.length > 0) {
        db.collection("messages").insertMany(recordsToInsert).catch((e) => {
          console.warn("Could not auto-insert messages to DB:", e);
        });
      }
    }
  } catch {
    // Non-blocking if mongo is not configured
  }

  return NextResponse.json({ results });
}