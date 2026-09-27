import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * Campaign Checkpoint API
 *
 * POST /api/campaigns/checkpoint
 *   Body: { campaignId, gatewayUsername, totalRecipients, sentCount, failedCount,
 *           remainingIndices: number[], processRows: ProcessRowSnapshot[], status }
 *   Saves/updates the live campaign state so it can be resumed after a page reload.
 *
 * GET  /api/campaigns/checkpoint?campaignId=xxx&gatewayUsername=xxx
 *   Returns the stored checkpoint for that campaign.
 *
 * DELETE /api/campaigns/checkpoint?campaignId=xxx&gatewayUsername=xxx
 *   Removes the checkpoint once the campaign fully completes.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      campaignId,
      gatewayUsername,
      totalRecipients,
      sentCount,
      failedCount,
      remainingIndices,
      processRows,
      status,
      campaignTitle,
      config, // { username, baseUrl, deviceId, simNumber, delayMs, jitterEnabled, batchSize, maxRetries }
    } = body;

    if (!campaignId || !gatewayUsername) {
      return NextResponse.json(
        { error: "campaignId and gatewayUsername are required" },
        { status: 400 }
      );
    }

    const checkpoint = {
      campaignId,
      gatewayUsername,
      campaignTitle,
      totalRecipients,
      sentCount,
      failedCount,
      remainingIndices: remainingIndices ?? [],
      processRows: processRows ?? [],
      status: status ?? "in_progress",
      config: config ?? {},
      updatedAt: new Date().toISOString(),
    };

    const db = await getDatabase();
    if (!db) {
      // If no DB, return OK — client will use localStorage as fallback
      return NextResponse.json({ ok: true, storage: "local" });
    }

    await db.collection("campaign_checkpoints").updateOne(
      { campaignId, gatewayUsername },
      { $set: checkpoint },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, storage: "mongodb" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkpoint save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const gatewayUsername = searchParams.get("gatewayUsername");

    if (!campaignId || !gatewayUsername) {
      return NextResponse.json(
        { error: "campaignId and gatewayUsername are required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ checkpoint: null, storage: "local" });
    }

    const checkpoint = await db
      .collection("campaign_checkpoints")
      .findOne({ campaignId, gatewayUsername });

    return NextResponse.json({ checkpoint: checkpoint ?? null, storage: "mongodb" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkpoint fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const gatewayUsername = searchParams.get("gatewayUsername");

    if (!campaignId || !gatewayUsername) {
      return NextResponse.json(
        { error: "campaignId and gatewayUsername are required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    if (db) {
      await db
        .collection("campaign_checkpoints")
        .deleteOne({ campaignId, gatewayUsername });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkpoint delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
