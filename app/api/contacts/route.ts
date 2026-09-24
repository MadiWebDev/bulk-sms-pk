import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ContactRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gatewayUsername = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";
    const group = searchParams.get("group");
    const search = searchParams.get("search");

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        contacts: [],
        gatewayUsername,
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

    if (group && group !== "all") query.group = group;
    if (search) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { nationalPhone: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const contacts = await db
      .collection<ContactRecord>("contacts")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const distinctGroups = await db
      .collection("contacts")
      .distinct("group", query.$or ? { $or: query.$or as any } : {});

    return NextResponse.json({
      storage: "mongodb",
      gatewayUsername,
      contacts,
      groups: distinctGroups.filter(Boolean),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query contacts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryGateway = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";
    const body = await req.json();
    let rawItems: Partial<ContactRecord>[] = [];
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
      return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
    }

    const items: ContactRecord[] = rawItems.map((c) => ({
      ...c,
      id: c.id || `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: c.name || "Unnamed",
      phone: c.phone || "",
      nationalPhone: c.nationalPhone || c.phone || "",
      operator: c.operator || "Jazz",
      group: c.group || "General",
      createdAt: c.createdAt || new Date().toISOString(),
      gatewayUsername: c.gatewayUsername || targetGateway,
      userId: c.userId || targetGateway,
    }));

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true, count: items.length });
    }

    const operations = items.map((contact) => ({
      updateOne: {
        filter: {
          phone: contact.phone,
          $or: [
            { gatewayUsername: contact.gatewayUsername },
            { userId: contact.gatewayUsername },
          ],
        },
        update: { $set: contact },
        upsert: true,
      },
    }));

    await db.collection("contacts").bulkWrite(operations);

    return NextResponse.json({
      storage: "mongodb",
      success: true,
      gatewayUsername: targetGateway,
      count: items.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to store contacts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const group = searchParams.get("group");
    const gatewayUsername = searchParams.get("gatewayUsername") || searchParams.get("userId") || "";

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
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

    if (id) {
      await db.collection("contacts").deleteOne({ id, ...gatewayFilter });
    } else if (group) {
      await db.collection("contacts").deleteMany({ group, ...gatewayFilter });
    }

    return NextResponse.json({ storage: "mongodb", success: true, gatewayUsername });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete contact(s)";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
