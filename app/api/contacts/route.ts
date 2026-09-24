import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ContactRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group");
    const search = searchParams.get("search");

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        contacts: [],
      });
    }

    const query: Record<string, unknown> = {};
    if (group && group !== "all") query.group = group;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { nationalPhone: { $regex: search, $options: "i" } },
      ];
    }

    const contacts = await db
      .collection<ContactRecord>("contacts")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const distinctGroups = await db.collection("contacts").distinct("group");

    return NextResponse.json({
      storage: "mongodb",
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
    const body = await req.json();
    const items: ContactRecord[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
    }

    const operations = items.map((contact) => ({
      updateOne: {
        filter: { phone: contact.phone },
        update: { $set: contact },
        upsert: true,
      },
    }));

    await db.collection("contacts").bulkWrite(operations);

    return NextResponse.json({
      storage: "mongodb",
      success: true,
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

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
    }

    if (id) {
      await db.collection("contacts").deleteOne({ id });
    } else if (group) {
      await db.collection("contacts").deleteMany({ group });
    }

    return NextResponse.json({ storage: "mongodb", success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete contact(s)";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
