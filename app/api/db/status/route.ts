import { NextResponse } from "next/server";
import { checkMongoHealth, getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const health = await checkMongoHealth();
  
  if (!health.connected) {
    return NextResponse.json({
      connected: false,
      message: health.error || "MongoDB is not connected. The app runs smoothly in Local Cache mode.",
      isConfigured: Boolean(process.env.MONGODB_URI),
    });
  }

  try {
    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({
        connected: false,
        message: "Failed to access database object.",
      });
    }

    const [messagesCount, campaignsCount, contactsCount, templatesCount] = await Promise.all([
      db.collection("messages").countDocuments().catch(() => 0),
      db.collection("campaigns").countDocuments().catch(() => 0),
      db.collection("contacts").countDocuments().catch(() => 0),
      db.collection("templates").countDocuments().catch(() => 0),
    ]);

    return NextResponse.json({
      connected: true,
      dbName: health.dbName,
      stats: {
        messages: messagesCount,
        campaigns: campaignsCount,
        contacts: contactsCount,
        templates: templatesCount,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error reading database stats";
    return NextResponse.json({
      connected: true,
      dbName: health.dbName,
      warning: errorMsg,
    });
  }
}
