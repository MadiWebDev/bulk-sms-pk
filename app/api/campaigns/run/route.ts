/**
 * Server-Side Campaign Runner — Vercel-Compatible
 *
 * Architecture (works locally AND on Vercel free/pro):
 *
 * POST /api/campaigns/run
 *   Body: { campaignId, campaignTitle, gatewayUsername, messages[], config, resumeFrom? }
 *   - On first call (resumeFrom=0 or omitted): creates the campaign_runs document.
 *   - Processes messages in a burst that fits within BURST_TIMEOUT_MS (8 s, safe
 *     for Vercel free plan which has a 10 s hard limit on serverless functions).
 *   - Checkpoints progress to MongoDB after EVERY message/job.
 *   - Returns { ok, campaignId, done, currentIndex, sentCount, failedCount, total }.
 *     • done=false → client must re-POST with resumeFrom=currentIndex to continue.
 *     • done=true  → campaign finished or was cancelled.
 *
 * GET  /api/campaigns/run?campaignId=xxx
 *   Returns live progress snapshot from MongoDB (polled every 3 s by the client).
 *
 * DELETE /api/campaigns/run?campaignId=xxx
 *   Marks status="cancelling" in MongoDB. The next burst start picks it up.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Why this works on Vercel:
 *   Old design used fire-and-forget background async — Vercel kills the process
 *   the moment the HTTP response is sent, so the background work dies immediately.
 *   New design: each POST call AWAITS its burst, checkpoints, then returns.
 *   The client loops by re-POSTing with resumeFrom. On local / self-hosted Next.js
 *   the same code works because there are no timeouts.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { validatePakistanPhone } from "@/lib/pakistan-phone";

export const runtime = "nodejs";
// 55 s on Vercel Pro; free plan caps at 10 s (we'll finish within 8 s per burst).
export const maxDuration = 55;

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How long (ms) a single POST call is allowed to run before yielding back to
 * the client. Must be well below Vercel's function timeout.
 * • Vercel free plan  : 10 s hard limit → keep at 8 s
 * • Vercel Pro        : 60 s limit       → could raise, but 8 s is fine
 * • Local / self-hosted: no limit        → client still re-triggers, no harm done
 */
const BURST_TIMEOUT_MS = 8_000;

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
  /** Resume from this absolute index (0 = fresh start) */
  resumeFrom?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jitteredDelay(base: number, enabled: boolean): number {
  if (!enabled || base === 0) return base;
  const v = base * 0.3;
  return Math.round(base - v + Math.random() * v * 2);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Burst runner ─────────────────────────────────────────────────────────────

interface BurstResult {
  done: boolean;
  cancelled: boolean;
  currentIndex: number;
  sentCount: number;
  failedCount: number;
}

async function runBurst(body: RunRequestBody): Promise<BurstResult> {
  const {
    campaignId,
    campaignTitle,
    gatewayUsername,
    messages,
    config,
    resumeFrom = 0,
  } = body;
  const {
    username,
    password,
    baseUrl,
    deviceId,
    simNumber,
    delayMs,
    jitterEnabled,
    batchSize,
  } = config;

  const authHeader =
    "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const apiBase = (
    baseUrl || "https://api.sms-gate.app/3rdparty/v1"
  ).replace(/\/$/, "");

  const db = await getDatabase();
  const totalMessages = messages.length;
  let sentCount = 0;
  let failedCount = 0;

  // ── Initialise or resume progress document ──────────────────────────────────
  if (db) {
    const existing = await db
      .collection("campaign_runs")
      .findOne({ campaignId });

    if (!existing) {
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
    } else {
      sentCount = existing.sentCount ?? 0;
      failedCount = existing.failedCount ?? 0;

      // Already terminal — return immediately
      if (existing.status === "completed" || existing.status === "cancelled") {
        return {
          done: true,
          cancelled: existing.status === "cancelled",
          currentIndex: existing.currentIndex ?? resumeFrom,
          sentCount,
          failedCount,
        };
      }

      // Cancel was requested — honour it
      if (existing.status === "cancelling") {
        await db.collection("campaign_runs").updateOne(
          { campaignId },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date().toISOString(),
            },
          }
        );
        return {
          done: true,
          cancelled: true,
          currentIndex: existing.currentIndex ?? resumeFrom,
          sentCount,
          failedCount,
        };
      }

      // Update status back to running (may have been left in limbo)
      await db.collection("campaign_runs").updateOne(
        { campaignId },
        { $set: { status: "running", updatedAt: new Date().toISOString() } }
      );
    }
  }

  // ── Build send jobs from resumeFrom ─────────────────────────────────────────
  interface SendJob {
    phones: string[];
    text: string;
    /** First absolute message index in this job */
    startIndex: number;
    /** Last absolute message index in this job */
    endIndex: number;
  }

  const buildJobs = (): SendJob[] => {
    const remaining = messages.slice(resumeFrom);
    if (batchSize <= 1) {
      return remaining.map((m, i) => ({
        phones: [m.phone],
        text: m.text,
        startIndex: resumeFrom + i,
        endIndex: resumeFrom + i,
      }));
    }
    const jobs: SendJob[] = [];
    let i = 0;
    while (i < remaining.length) {
      const anchor = remaining[i];
      const group = [anchor];
      while (
        group.length < batchSize &&
        i + group.length < remaining.length &&
        remaining[i + group.length].text === anchor.text
      ) {
        group.push(remaining[i + group.length]);
      }
      jobs.push({
        phones: group.map((m) => m.phone),
        text: anchor.text,
        startIndex: resumeFrom + i,
        endIndex: resumeFrom + i + group.length - 1,
      });
      i += group.length;
    }
    return jobs;
  };

  const jobs = buildJobs();
  let currentIndex = resumeFrom;
  const burstStart = Date.now();

  for (let j = 0; j < jobs.length; j++) {
    // ── Time budget check ────────────────────────────────────────────────────
    if (Date.now() - burstStart >= BURST_TIMEOUT_MS) {
      // Yield to client — it will re-POST with resumeFrom=currentIndex
      break;
    }

    // ── DB cancel check ──────────────────────────────────────────────────────
    if (db) {
      const doc = await db
        .collection("campaign_runs")
        .findOne({ campaignId }, { projection: { status: 1 } });
      if (doc?.status === "cancelling" || doc?.status === "cancelled") {
        await db.collection("campaign_runs").updateOne(
          { campaignId },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date().toISOString(),
            },
          }
        );
        return { done: true, cancelled: true, currentIndex, sentCount, failedCount };
      }
    }

    const job = jobs[j];

    // ── Inter-job delay (skip before first job) ──────────────────────────────
    if (j > 0 && delayMs > 0) {
      const sleepFor = jitteredDelay(delayMs, jitterEnabled);
      // Don't sleep if it would blow the burst budget
      if (Date.now() - burstStart + sleepFor >= BURST_TIMEOUT_MS) {
        break; // yield to client
      }
      await sleep(sleepFor);
    }

    // ── Validate phones ───────────────────────────────────────────────────────
    const validPhones: string[] = [];
    for (const phone of job.phones) {
      const check = validatePakistanPhone(phone);
      if (check.isValid && check.e164) validPhones.push(check.e164);
    }

    let ok = false;
    let gatewayId: string | undefined;
    let errorMsg = "";

    if (validPhones.length === 0) {
      errorMsg = "No valid Pakistani numbers in this batch";
    } else {
      try {
        const payload: Record<string, unknown> = {
          textMessage: { text: job.text.trim() },
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
          errorMsg =
            (data && (data.message || data.error || data.title)) ||
            `HTTP ${res.status}`;
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Network error";
      }
    }

    if (ok) sentCount += job.phones.length;
    else failedCount += job.phones.length;

    currentIndex = job.endIndex + 1;

    // ── Checkpoint to MongoDB after every job ─────────────────────────────────
    if (db) {
      const timestamp = new Date().toISOString();

      // Persist message records for this job
      const msgRecords = job.phones.map((phone, k) => {
        const absIdx = job.startIndex + k;
        const msg = messages[absIdx] ?? messages[job.endIndex];
        const check = validatePakistanPhone(phone);
        const rid = gatewayId
          ? `${gatewayId}_${phone.slice(-4)}_${k}`
          : `msg_${Date.now()}_${absIdx}`;
        return {
          id: rid,
          gatewayUsername,
          userId: gatewayUsername,
          phone: check.e164 || phone,
          nationalPhone: check.national || phone,
          operator: check.operator || msg?.operator || "Unknown",
          text: job.text,
          status: ok ? "queued" : "failed",
          gatewayId: gatewayId ?? null,
          error: ok ? undefined : errorMsg,
          timestamp,
          campaignId,
          campaignTitle,
          simNumber,
        };
      });

      if (msgRecords.length > 0) {
        await db
          .collection("messages")
          .bulkWrite(
            msgRecords.map((r) => ({
              updateOne: {
                filter: { id: r.id },
                update: { $set: r },
                upsert: true,
              },
            }))
          )
          .catch(() => {});
      }

      // Update progress counters
      await db
        .collection("campaign_runs")
        .updateOne(
          { campaignId },
          {
            $set: {
              sentCount,
              failedCount,
              currentIndex,
              updatedAt: timestamp,
            },
          }
        )
        .catch(() => {});
    }
  }

  // ── Determine completion ──────────────────────────────────────────────────
  const done = currentIndex >= totalMessages;

  if (done && db) {
    const timestamp = new Date().toISOString();
    await db
      .collection("campaign_runs")
      .updateOne(
        { campaignId },
        {
          $set: {
            status: "completed",
            sentCount,
            failedCount,
            currentIndex: totalMessages,
            completedAt: timestamp,
            updatedAt: timestamp,
          },
        }
      )
      .catch(() => {});

    // Save campaign summary record
    await db
      .collection("campaigns")
      .updateOne(
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
      )
      .catch(() => {});
  }

  return { done, cancelled: false, currentIndex, sentCount, failedCount };
}

// ─── POST — launch / continue campaign burst ──────────────────────────────────

export async function POST(req: NextRequest) {
  let body: RunRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.campaignId ||
    !body.gatewayUsername ||
    !body.config?.username ||
    !body.config?.password
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: campaignId, gatewayUsername, config.username, config.password",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is empty" },
      { status: 400 }
    );
  }

  try {
    const result = await runBurst(body);
    return NextResponse.json({
      ok: true,
      campaignId: body.campaignId,
      total: body.messages.length,
      done: result.done,
      cancelled: result.cancelled,
      currentIndex: result.currentIndex,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (err) {
    console.error(`[campaign/run] Error for ${body.campaignId}:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
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

  const db = await getDatabase();
  if (db) {
    await db
      .collection("campaign_runs")
      .updateOne(
        { campaignId },
        {
          $set: {
            status: "cancelling",
            updatedAt: new Date().toISOString(),
          },
        }
      )
      .catch(() => {});
  }

  return NextResponse.json({ ok: true, campaignId });
}
