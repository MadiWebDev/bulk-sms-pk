import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { TemplateRecord } from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        storage: "local",
        templates: DEFAULT_TEMPLATES,
      });
    }

    let customTemplates = await db
      .collection<TemplateRecord>("templates")
      .find({})
      .toArray();

    // If MongoDB collection is empty, auto-seed with defaults
    if (customTemplates.length === 0 && DEFAULT_TEMPLATES.length > 0) {
      try {
        const bulkOps = DEFAULT_TEMPLATES.map((t) => ({
          updateOne: {
            filter: { id: t.id },
            update: { $set: t },
            upsert: true,
          },
        }));
        await db.collection("templates").bulkWrite(bulkOps);
        customTemplates = await db
          .collection<TemplateRecord>("templates")
          .find({})
          .toArray();
      } catch (seedErr) {
        console.error("Auto-seed templates to Mongo error:", seedErr);
      }
    }

    // Merge & deduplicate by ID, prioritizing database version
    const map = new Map<string, TemplateRecord>();
    DEFAULT_TEMPLATES.forEach((t) => map.set(t.id, t));
    customTemplates.forEach((t) => {
      // remove Mongo's _id if present or keep clean TemplateRecord
      const cleanTpl: TemplateRecord = {
        id: t.id,
        name: t.name,
        category: t.category,
        text: t.text,
        variables: t.variables || [],
        isPreset: t.isPreset,
      };
      map.set(t.id, cleanTpl);
    });

    const merged = Array.from(map.values());

    return NextResponse.json({
      storage: "mongodb",
      templates: merged,
      count: merged.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Reseed / Sync all presets to MongoDB
export async function PUT() {
  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: "MongoDB not connected" }, { status: 503 });
    }

    const bulkOps = DEFAULT_TEMPLATES.map((t) => ({
      updateOne: {
        filter: { id: t.id },
        update: { $set: { ...t, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    const result = await db.collection("templates").bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      storage: "mongodb",
      upserted: result.upsertedCount,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      total: DEFAULT_TEMPLATES.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reseed templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const template: TemplateRecord = await req.json();

    if (!template.id || !template.name || !template.text) {
      return NextResponse.json({ error: "Missing required template fields" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
    }

    await db.collection("templates").updateOne(
      { id: template.id },
      { $set: template },
      { upsert: true }
    );

    return NextResponse.json({ storage: "mongodb", success: true, id: template.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing template ID" }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ storage: "local", success: true });
    }

    await db.collection("templates").deleteOne({ id });

    return NextResponse.json({ storage: "mongodb", success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
