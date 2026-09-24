import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

export async function POST(req: NextRequest) {
  let body: {
    username?: string;
    password?: string;
    baseUrl?: string;
    id?: string;
    ids?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const username = body.username?.trim() || process.env.SMSGATE_USERNAME || "";
  const password = body.password?.trim() || process.env.SMSGATE_PASSWORD || "";
  const baseUrl = (body.baseUrl?.trim() || process.env.SMS_GATE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Missing gateway username or password" },
      { status: 400 }
    );
  }

  const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  // Single ID query
  if (body.id) {
    try {
      const res = await fetch(`${baseUrl}/messages/${encodeURIComponent(body.id)}`, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return NextResponse.json(
          { error: (data && (data.message || data.error)) || `HTTP ${res.status}` },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Network error contacting gateway" },
        { status: 502 }
      );
    }
  }

  // Batch ID query
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const statuses: Record<string, { state?: string; error?: string }> = {};

    await Promise.all(
      body.ids.slice(0, 50).map(async (id) => {
        try {
          const res = await fetch(`${baseUrl}/messages/${encodeURIComponent(id)}`, {
            headers: {
              Authorization: authHeader,
              Accept: "application/json",
            },
            cache: "no-store",
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data) {
            statuses[id] = { state: data.state || data.recipients?.[0]?.state || "Unknown" };
          } else {
            statuses[id] = { error: data?.message || `HTTP ${res.status}` };
          }
        } catch (e) {
          statuses[id] = { error: e instanceof Error ? e.message : "Network error" };
        }
      })
    );

    return NextResponse.json({ statuses });
  }

  return NextResponse.json({ error: "Missing 'id' or 'ids' parameter" }, { status: 400 });
}