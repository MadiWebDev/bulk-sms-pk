import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    username?: string;
    password?: string;
    baseUrl?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const username = body.username?.trim() || process.env.SMSGATE_USERNAME || "";
  const password = body.password?.trim() || process.env.SMSGATE_PASSWORD || "";
  const baseUrl =
    body.baseUrl?.trim() ||
    process.env.SMS_GATE_BASE_URL ||
    "https://api.sms-gate.app/3rdparty/v1";

  if (!username || !password) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing credentials. Please provide Username and Password or configure them in .env.",
      },
      { status: 400 }
    );
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  try {
    // Test auth by fetching the message list endpoint with limit=1
    const res = await fetch(`${cleanBaseUrl}/messages?limit=1`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message: "Successfully connected and authenticated with sms-gate.app!",
        status: res.status,
      });
    }

    if (res.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          status: 401,
          error:
            "Authentication failed (HTTP 401 Unauthorized). In the SMS Gateway app on your Android phone, ensure 'Cloud Server' is ON and check the Login / Password shown there.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        error:
          data?.message ||
          data?.error ||
          `Gateway returned HTTP ${res.status}. Check your server settings.`,
      },
      { status: res.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown connection error";
    return NextResponse.json(
      {
        ok: false,
        error: `Could not reach ${cleanBaseUrl}: ${message}. Verify internet connectivity and server URL.`,
      },
      { status: 502 }
    );
  }
}
