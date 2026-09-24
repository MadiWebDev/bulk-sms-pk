import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { CampaignRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        campaigns: [],
      });
    }

    const campaigns = await db
      .collection<CampaignRecord>("campaigns")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      storage: "mongodb",
      campaigns,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query campaigns";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign: CampaignRecord = await req.json();

    if (!campaign.id || !campaign.title) {
      return NextResponse.json({ error: "Missing required campaign fields" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
    }

    await db.collection("campaigns").updateOne(
      { id: campaign.id },
      { $set: campaign },
      { upsert: true }
    );

    return NextResponse.json({ storage: "mongodb", success: true, campaignId: campaign.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save campaign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
