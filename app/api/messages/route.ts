import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { MessageRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        messages: [],
        message: "MongoDB not connected. Storage handled locally in browser.",
      });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const operator = searchParams.get("operator");
    const search = searchParams.get("search");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    const query: Record<string, unknown> = {};

    if (campaignId) query.campaignId = campaignId;
    if (status && status !== "all") query.status = status;
    if (operator && operator !== "all") query.operator = operator;
    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: "i" } },
        { nationalPhone: { $regex: search, $options: "i" } },
        { text: { $regex: search, $options: "i" } },
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
    const body = await req.json();
    const items: MessageRecord[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: "No messages to store" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      // Acknowledge receipt even without Mongo
      return NextResponse.json({
        storage: "local",
        saved: 0,
        message: "MongoDB not connected; item should be stored in client state.",
      });
    }

    // Upsert or insert items
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
    if (!db) {
      return NextResponse.json({ success: true, storage: "local" });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (campaignId) {
      await db.collection("messages").deleteMany({ campaignId });
    } else {
      // Clear all
      await db.collection("messages").deleteMany({});
    }

    return NextResponse.json({ success: true, storage: "mongodb" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete messages";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
