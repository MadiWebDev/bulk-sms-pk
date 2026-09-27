import { NextRequest, NextResponse } from "next/server";
import { validatePakistanPhone } from "@/lib/pakistan-phone";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

// CONCURRENCY = 1: Android's SMS service is single-threaded. Parallel requests
// cause the permission dialog to re-appear for every concurrent job and saturate
// the send queue, resulting in failures. Always send one request at a time.
const CONCURRENCY = 1;

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
  ttl?: number;
  gatewayUsername?: string; // for DB scoping
  campaignId?: string;
  campaignTitle?: string;
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

export async function POST(req: NextRequest) {
  let body: SendRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const username = body.username?.trim() || process.env.SMSGATE_USERNAME || "";
  const password = body.password?.trim() || process.env.SMSGATE_PASSWORD || "";
  const baseUrl = (
    body.baseUrl?.trim() ||
    process.env.SMS_GATE_BASE_URL ||
    process.env.SMSGATE_API_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const deviceId = body.deviceId?.trim() || process.env.SMSGATE_DEVICE_ID || "";
  const simNumber =
    typeof body.simNumber === "number"
      ? body.simNumber
      : Number(process.env.SMSGATE_SIM_NUMBER || "1") || 1;
  const withDeliveryReport = body.withDeliveryReport ?? true;
  const ttl = body.ttl ?? 86400; // 24h — gives Android more time to deliver queued messages
  const gatewayUsername = body.gatewayUsername?.trim() || username;

  if (!username || !password) {
    return NextResponse.json(
      {
        error:
          "Missing gateway credentials. Provide username & password or set SMSGATE_USERNAME / SMSGATE_PASSWORD in .env.",
      },
      { status: 400 }
    );
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "No messages to send. items array is empty." },
      { status: 400 }
    );
  }

  // Validate all items before touching the gateway
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.text?.trim()) {
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

      // Validate and normalise phone numbers for this item
      const validatedPhones: string[] = [];
      const invalidReasons: string[] = [];

      for (const phone of item.phoneNumbers) {
        const check = validatePakistanPhone(phone);
        if (check.isValid && check.e164) {
          validatedPhones.push(check.e164);
        } else {
          invalidReasons.push(`${phone}: ${check.reason || "invalid Pakistani number"}`);
        }
      }

      if (validatedPhones.length === 0) {
        results[index] = {
          phoneNumbers: item.phoneNumbers,
          ok: false,
          error: `Rejected: no valid Pakistan mobile numbers (${invalidReasons.join("; ")})`,
        };
        continue;
      }

      // One request per item — no internal throttling delay here.
      // The caller (bulk-sms page) is responsible for pacing between items
      // so the Android device is never overwhelmed.
      const payload: Record<string, unknown> = {
        textMessage: { text: item.text.trim() },
        phoneNumbers: validatedPhones,
        withDeliveryReport,
        ttl,
        simNumber,
        priority: 10, // lower priority = less chance of triggering Android battery/rate warnings
      };

      if (deviceId) {
        payload.deviceId = deviceId;
      }

      try {
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
          error:
            err instanceof Error ? err.message : "Network error contacting SMS gateway",
        };
      }
    }
  }

  // CONCURRENCY = 1: strictly sequential — no parallel gateway requests
  const poolSize = Math.min(CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  // Persist to MongoDB (non-blocking)
  try {
    const { getDatabase } = await import("@/lib/mongodb");
    const db = await getDatabase();
    if (db) {
      const timestamp = new Date().toISOString();
      const records: Record<string, unknown>[] = [];

      items.forEach((item, idx) => {
        const res = results[idx];
        // When one item has multiple phoneNumbers, store a record per phone
        const phones = res?.phoneNumbers?.length ? res.phoneNumbers : item.phoneNumbers;
        phones.forEach((phone) => {
          const check = validatePakistanPhone(phone);
          records.push({
            id:
              res?.id
                ? `${res.id}_${phone.replace(/\D/g, "").slice(-4)}`
                : `msg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            gatewayUsername,
            userId: gatewayUsername,
            phone: check.e164 || phone,
            nationalPhone: check.national || phone,
            operator: check.operator || "Unknown",
            text: item.text,
            status: res?.ok ? "queued" : "failed",
            gatewayId: res?.id,
            error: res?.error,
            timestamp,
            campaignId: body.campaignId,
            campaignTitle: body.campaignTitle,
            simNumber,
          });
        });
      });

      if (records.length > 0) {
        db.collection("messages")
          .insertMany(records)
          .catch((e) => console.warn("[send] MongoDB insert failed:", e));
      }
    }
  } catch {
    // Non-blocking — app works without MongoDB
  }

  return NextResponse.json({ results });
}
