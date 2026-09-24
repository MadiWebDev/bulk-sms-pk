import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { CampaignRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "user_1";

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        userId,
        campaigns: [],
      });
    }

    const campaigns = await db
      .collection<CampaignRecord>("campaigns")
      .find({ $or: [{ userId: userId }, { userId: { $exists: false } }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      storage: "mongodb",
      userId,
      campaigns,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query campaigns";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");
    const campaign: CampaignRecord = await req.json();
    const userId = campaign.userId || queryUserId || "user_1";

    if (!campaign.id || !campaign.title) {
      return NextResponse.json({ error: "Missing required campaign fields" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true, userId });
    }

    campaign.userId = userId;

    await db.collection("campaigns").updateOne(
      { id: campaign.id },
      { $set: campaign },
      { upsert: true }
    );

    return NextResponse.json({ storage: "mongodb", success: true, userId, campaignId: campaign.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save campaign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
