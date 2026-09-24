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

    const customTemplates = await db
      .collection<TemplateRecord>("templates")
      .find({})
      .toArray();

    // Merge default templates with custom templates from database
    const merged = [...DEFAULT_TEMPLATES, ...customTemplates];

    return NextResponse.json({
      storage: "mongodb",
      templates: merged,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query templates";
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
