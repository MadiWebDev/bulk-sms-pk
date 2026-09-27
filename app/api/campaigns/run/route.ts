/**
 * Server-Side Campaign Runner
 *
 * This route owns the entire bulk-send loop so it runs on the Node.js server
 * process — completely independent of whether the browser tab is open, closed,
 * refreshed, or navigated away.
 *
 * POST /api/campaigns/run
 *   Body: { campaignId, campaignTitle, gatewayUsername, messages[], config }
 *   Starts the send loop in the background (fire-and-forget async).
 *   Returns { ok: true, campaignId } immediately.
 *
 * GET  /api/campaigns/run?campaignId=xxx
 *   Returns live progress from MongoDB (poll every 3 s from the client).
 *
 * DELETE /api/campaigns/run?campaignId=xxx
 *   Signals cancellation by writing status="cancelling" to MongoDB.
 *   The running loop checks this flag and stops after the current message.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { validatePakistanPhone } from "@/lib/pakistan-phone";

export const runtime = "nodejs";
// Allow this route up to 30 minutes — long enough for a 5000-message campaign
export const maxDuration = 1800;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageItem {
  phone: string;
  nationalPhone?: string;
  operator?: string;
  text: string;
  rowIndex: number;
}

interface CampaignConfig {
  username: string;
  password: string;
  baseUrl: string;
  deviceId?: string;
  simNumber: number;
  delayMs: number;
  jitterEnabled: boolean;
  batchSize: number;
}

interface RunRequestBody {
  campaignId: string;
  campaignTitle: string;
  gatewayUsername: string;
  messages: MessageItem[];
  config: CampaignConfig;
  /** Resume from this index (0 = fresh start) */
  resumeFrom?: number;
}

// ─── Jitter helper ────────────────────────────────────────────────────────────

function jitteredDelay(base: number, enabled: boolean): number {
  if (!enabled || base === 0) return base;
  const v = base * 0.3;
  return Math.round(base - v + Math.random() * v * 2);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── In-memory cancel flags ───────────────────────────────────────────────────
// Keyed by campaignId. The DELETE handler sets this; the loop checks it.
const cancelFlags = new Map<string, boolean>();

// ─── Background runner ────────────────────────────────────────────────────────

async function runCampaignBackground(body: RunRequestBody) {
  const { campaignId, campaignTitle, gatewayUsername, messages, config, resumeFrom = 0 } = body;
  const { username, password, baseUrl, deviceId, simNumber, delayMs, jitterEnabled, batchSize } = config;
  const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const apiBase = (baseUrl || "https://api.sms-gate.app/3rdparty/v1").replace(/\/$/, "");

  const db = await getDatabase();

  // ── Initialise progress document ──
  const totalMessages = messages.length;
  let sentCount = 0;
  let failedCount = 0;

  if (db) {
    // Count already-done rows when resuming
    const existing = await db.collection("campaign_runs").findOne({ campaignId });
    if (existing) {
      sentCount = existing.sentCount || 0;
      failedCount = existing.failedCount || 0;
    } else {
      await db.collection("campaign_runs").insertOne({
        campaignId,
        campaignTitle,
        gatewayUsername,
        status: "running",
        totalMessages,
        sentCount: 0,
        failedCount: 0,
        currentIndex: resumeFrom,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // ── Build batches ──
  interface Batch {
    phones: string[];
    text: string;
    indices: number[];
  }

  const buildBatches = (): Batch[] => {
    const remaining = messages.slice(resumeFrom);
    if (batchSize <= 1) {
      return remaining.map((m, i) => ({
        phones: [m.phone],
        text: m.text,
        indices: [resumeFrom + i],
      }));
    }
    const batches: Batch[] = [];
    let i = 0;
    while (i < remaining.length) {
      const anchor = remaining[i];
      const group = [anchor];
      const gIdx = [resumeFrom + i];
      while (
        group.length < batchSize &&
        i + group.length < remaining.length &&
        remaining[i + group.length].text === anchor.text
      ) {
        group.push(remaining[i + group.length]);
        gIdx.push(resumeFrom + i + group.length - 1);
      }
      batches.push({ phones: group.map((m) => m.phone), text: anchor.text, indices: gIdx });
      i += group.length;
    }
    return batches;
  };

  const batches = buildBatches();
  const rowResults: Array<{ index: number; ok: boolean; gatewayId?: string; error?: string }> = [];
  let currentIndex = resumeFrom;

  for (let b = 0; b < batches.length; b++) {
    // Check cancel flag
    if (cancelFlags.get(campaignId)) {
      cancelFlags.delete(campaignId);
      if (db) {
        await db.collection("campaign_runs").updateOne(
          { campaignId },
          { $set: { status: "cancelled", updatedAt: new Date().toISOString() } }
        );
      }
      return;
    }

    // Check cancel in DB (supports cross-process cancel e.g. server restart)
    if (db) {
      const doc = await db.collection("campaign_runs").findOne({ campaignId }, { projection: { status: 1 } });
      if (doc?.status === "cancelling") {
        await db.collection("campaign_runs").updateOne(
          { campaignId },
          { $set: { status: "cancelled", updatedAt: new Date().toISOString() } }
        );
        return;
      }
    }

    const batch = batches[b];

    // Validate phones
    const validPhones: string[] = [];
    for (const phone of batch.phones) {
      const check = validatePakistanPhone(phone);
      if (check.isValid && check.e164) validPhones.push(check.e164);
    }

    // Delay between batches (not before the first one)
    if (b > 0 && delayMs > 0) {
      await sleep(jitteredDelay(delayMs, jitterEnabled));
    }

    let ok = false;
    let gatewayId: string | undefined;
    let errorMsg = "";

    if (validPhones.length === 0) {
      errorMsg = "No valid Pakistani numbers in this batch";
    } else {
      try {
        const payload: Record<string, unknown> = {
          textMessage: { text: batch.text.trim() },
          phoneNumbers: validPhones,
          withDeliveryReport: true,
          ttl: 86400,
          simNumber,
          priority: 10,
        };
        if (deviceId?.trim()) payload.deviceId = deviceId.trim();

        const res = await fetch(`${apiBase}/messages`, {
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
        if (res.ok && data?.id) {
          ok = true;
          gatewayId = data.id;
        } else {
          errorMsg = (data && (data.message || data.error || data.title)) || `HTTP ${res.status}`;
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Network error";
      }
    }

    // Record result for each row in the batch
    batch.indices.forEach((idx) => {
      rowResults.push({ index: idx, ok, gatewayId, error: ok ? undefined : errorMsg });
    });

    if (ok) sentCount += batch.phones.length;
    else failedCount += batch.phones.length;

    currentIndex = (batch.indices[batch.indices.length - 1] ?? currentIndex) + 1;

    // ── Persist message records + update progress every 50 ──
    if (db && (rowResults.length % 50 === 0 || b === batches.length - 1)) {
      const timestamp = new Date().toISOString();
      const msgRecords = rowResults.slice(-50).map(({ index, ok: rowOk, gatewayId: gid, error }) => {
        const msg = messages[index];
        const check = validatePakistanPhone(msg.phone);
        return {
          id: gid ? `${gid}_${msg.phone.slice(-4)}` : `msg_${Date.now()}_${index}`,
          gatewayUsername,
          userId: gatewayUsername,
          phone: check.e164 || msg.phone,
          nationalPhone: check.national || msg.phone,
          operator: check.operator || msg.operator || "Unknown",
          text: msg.text,
          status: rowOk ? "queued" : "failed",
          gatewayId: gid,
          error: error || undefined,
          timestamp,
          campaignId,
          campaignTitle,
          simNumber,
        };
      });

      // Upsert message records
      if (msgRecords.length > 0) {
        await db.collection("messages").bulkWrite(
          msgRecords.map((r) => ({
            updateOne: {
              filter: { id: r.id, $or: [{ gatewayUsername }, { userId: gatewayUsername }] },
              update: { $set: r },
              upsert: true,
            },
          }))
        ).catch(() => {});
      }

      // Update progress
      await db.collection("campaign_runs").updateOne(
        { campaignId },
        {
          $set: {
            sentCount,
            failedCount,
            currentIndex,
            updatedAt: new Date().toISOString(),
          },
        }
      ).catch(() => {});
    }
  }

  // ── Final status ──
  if (db) {
    await db.collection("campaign_runs").updateOne(
      { campaignId },
      {
        $set: {
          status: "completed",
          sentCount,
          failedCount,
          currentIndex: totalMessages,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
    ).catch(() => {});

    // Save campaign record
    await db.collection("campaigns").updateOne(
      { id: campaignId },
      {
        $set: {
          id: campaignId,
          gatewayUsername,
          userId: gatewayUsername,
          title: campaignTitle,
          createdAt: new Date().toISOString(),
          totalRecipients: totalMessages,
          sentCount,
          failedCount,
          status: "completed",
          simNumber,
        },
      },
      { upsert: true }
    ).catch(() => {});
  }
}

// ─── POST — launch campaign ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: RunRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.campaignId || !body.gatewayUsername || !body.config?.username || !body.config?.password) {
    return NextResponse.json({ error: "Missing required fields: campaignId, gatewayUsername, config.username, config.password" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array is empty" }, { status: 400 });
  }

  // Clear any stale cancel flag for this campaign
  cancelFlags.delete(body.campaignId);

  // Fire-and-forget — this runs entirely on the server, browser can close safely
  runCampaignBackground(body).catch((err) => {
    console.error(`[campaign/run] Background error for ${body.campaignId}:`, err);
  });

  return NextResponse.json({ ok: true, campaignId: body.campaignId, total: body.messages.length });
}

// ─── GET — poll progress ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const db = await getDatabase();
  if (!db) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  const run = await db.collection("campaign_runs").findOne({ campaignId });
  if (!run) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    campaignId: run.campaignId,
    campaignTitle: run.campaignTitle,
    status: run.status,
    totalMessages: run.totalMessages,
    sentCount: run.sentCount,
    failedCount: run.failedCount,
    currentIndex: run.currentIndex,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    updatedAt: run.updatedAt,
  });
}

// ─── DELETE — cancel campaign ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // Set in-memory flag for the running loop in this process
  cancelFlags.set(campaignId, true);

  // Also write to DB so a restarted server process picks it up
  const db = await getDatabase();
  if (db) {
    await db.collection("campaign_runs").updateOne(
      { campaignId },
      { $set: { status: "cancelling", updatedAt: new Date().toISOString() } }
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, campaignId });
}
