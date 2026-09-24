import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { CampaignRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gatewayUsername = searchParams.get("gatewayUsername")?.trim() || searchParams.get("userId")?.trim() || "";

    if (!gatewayUsername) {
      return NextResponse.json({
        storage: "mongodb",
        gatewayUsername: "",
        campaigns: [],
      });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        gatewayUsername,
        campaigns: [],
      });
    }

    const campaigns = await db
      .collection<CampaignRecord>("campaigns")
      .find({
        $or: [
          { gatewayUsername: gatewayUsername },
          { userId: gatewayUsername },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      storage: "mongodb",
      gatewayUsername,
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
    const queryGateway = searchParams.get("gatewayUsername")?.trim() || searchParams.get("userId")?.trim() || "";
    const campaign: CampaignRecord = await req.json();
    const gatewayUsername = campaign.gatewayUsername?.trim() || campaign.userId?.trim() || queryGateway;

    if (!gatewayUsername) {
      return NextResponse.json({ error: "Gateway credential (gatewayUsername) is required for campaigns" }, { status: 400 });
    }

    if (!campaign.id || !campaign.title) {
      return NextResponse.json({ error: "Missing required campaign fields" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true, gatewayUsername });
    }

    campaign.gatewayUsername = gatewayUsername;
    campaign.userId = gatewayUsername;

    await db.collection("campaigns").updateOne(
      { id: campaign.id },
      { $set: campaign },
      { upsert: true }
    );

    return NextResponse.json({ storage: "mongodb", success: true, gatewayUsername, campaignId: campaign.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save campaign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
