import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { MessageRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gatewayUsername = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const operator = searchParams.get("operator");
    const search = searchParams.get("search");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        messages: [],
        gatewayUsername,
        message: "MongoDB not connected. Storage handled locally in browser.",
      });
    }

    const query: Record<string, unknown> = {};

    if (gatewayUsername) {
      query.$or = [
        { gatewayUsername: gatewayUsername },
        { userId: gatewayUsername },
        { gatewayUsername: { $exists: false }, userId: { $exists: false } },
      ];
    }

    if (campaignId) query.campaignId = campaignId;
    if (status && status !== "all") query.status = status;
    if (operator && operator !== "all") query.operator = operator;
    if (search) {
      query.$and = [
        {
          $or: [
            { phone: { $regex: search, $options: "i" } },
            { nationalPhone: { $regex: search, $options: "i" } },
            { text: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const messages = await db
      .collection<MessageRecord>("messages")
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      storage: "mongodb",
      gatewayUsername,
      messages,
      total: messages.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query messages";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryGateway = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";
    const body = await req.json();
    let rawItems: Partial<MessageRecord>[] = [];
    let payloadGateway = queryGateway;

    if (Array.isArray(body)) {
      rawItems = body;
    } else if (body && Array.isArray(body.items)) {
      rawItems = body.items;
      if (body.gatewayUsername) payloadGateway = body.gatewayUsername;
      else if (body.userId) payloadGateway = body.userId;
    } else if (body) {
      rawItems = [body];
      if (body.gatewayUsername) payloadGateway = body.gatewayUsername;
      else if (body.userId) payloadGateway = body.userId;
    }

    const targetGateway = payloadGateway || "default";

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "No messages to store" }, { status: 400 });
    }

    const items: MessageRecord[] = rawItems.map((item) => ({
      ...item,
      id: item.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phone: item.phone || "",
      text: item.text || "",
      status: item.status || "queued",
      timestamp: item.timestamp || new Date().toISOString(),
      gatewayUsername: item.gatewayUsername || targetGateway,
      userId: item.userId || targetGateway,
    }));

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        saved: 0,
        gatewayUsername: targetGateway,
        message: "MongoDB not connected; item should be stored in client state.",
      });
    }

    const operations = items.map((item) => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: item },
        upsert: true,
      },
    }));

    const result = await db.collection("messages").bulkWrite(operations);

    return NextResponse.json({
      storage: "mongodb",
      success: true,
      gatewayUsername: targetGateway,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save message log";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await getDatabase();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const gatewayUsername = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";

    if (!db) {
      return NextResponse.json({ success: true, storage: "local", gatewayUsername });
    }

    const gatewayFilter = gatewayUsername
      ? {
          $or: [
            { gatewayUsername: gatewayUsername },
            { userId: gatewayUsername },
            { gatewayUsername: { $exists: false }, userId: { $exists: false } },
          ],
        }
      : {};

    if (campaignId) {
      await db.collection("messages").deleteMany({ campaignId, ...gatewayFilter });
    } else {
      await db.collection("messages").deleteMany(gatewayFilter);
    }

    return NextResponse.json({ success: true, storage: "mongodb", gatewayUsername });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete messages";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
