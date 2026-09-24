import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { GatewayConfig } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUsername = searchParams.get("username")?.trim();

    const db = await getDatabase();
    let savedGateways: GatewayConfig[] = [];

    if (db) {
      savedGateways = await db
        .collection<GatewayConfig>("gateway_credentials")
        .find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .toArray();
    }

    // Determine target gateway
    let targetGateway: GatewayConfig | null = null;
    if (requestedUsername && savedGateways.length > 0) {
      targetGateway = savedGateways.find((g) => g.username === requestedUsername) || null;
    }

    // If not found by username or none requested, pick the most recent saved gateway
    if (!targetGateway && savedGateways.length > 0) {
      targetGateway = savedGateways[0];
    }

    // If still null, fallback to .env credentials
    if (!targetGateway) {
      const envUsername = process.env.SMSGATE_USERNAME || "";
      const envPassword = process.env.SMSGATE_PASSWORD || "";
      const envDeviceId = process.env.SMSGATE_DEVICE_ID || "";
      const envSimNumber = process.env.SMSGATE_SIM_NUMBER || "1";
      const envBaseUrl = process.env.SMS_GATE_BASE_URL || "https://api.sms-gate.app/3rdparty/v1";

      targetGateway = {
        username: envUsername,
        password: envPassword,
        baseUrl: envBaseUrl,
        deviceId: envDeviceId,
        simNumber: Number(envSimNumber) || 1,
        isVerified: false,
        name: envUsername ? `Gateway (${envUsername})` : "Default Gateway",
      };
    }

    const maskedUsername = targetGateway.username
      ? targetGateway.username.length > 3
        ? targetGateway.username.substring(0, 2) + "***" + targetGateway.username.substring(targetGateway.username.length - 1)
        : "***"
      : "";

    // Return the active gateway config + list of all saved credentials
    return NextResponse.json({
      storage: savedGateways.length > 0 ? "mongodb" : "env",
      isConfigured: Boolean(targetGateway.username && targetGateway.password),
      activeGateway: {
        ...targetGateway,
        maskedUsername,
      },
      savedGateways: savedGateways.map((g) => ({
        username: g.username,
        name: g.name || `Android (${g.username})`,
        baseUrl: g.baseUrl,
        deviceId: g.deviceId,
        simNumber: g.simNumber,
        isVerified: g.isVerified ?? true,
        updatedAt: g.updatedAt,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve gateway credentials";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = (body.username || "").trim();
    const password = (body.password || "").trim();
    const baseUrl = (body.baseUrl || "https://api.sms-gate.app/3rdparty/v1").trim().replace(/\/$/, "");
    const deviceId = (body.deviceId || "").trim();
    const simNumber = Number(body.simNumber) || 1;
    const name = (body.name || "").trim() || `Android (${username})`;

    if (!username || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Username and Password are required to test and save Android Gateway Credentials.",
        },
        { status: 400 }
      );
    }

    // 1. FIRST TEST CREDENTIALS WITH SMS GATEWAY APP
    const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    let testSuccess = false;
    let testErrorMessage = "";
    let latencyMs = 0;

    try {
      const startTime = performance.now();
      const pingRes = await fetch(`${baseUrl}/messages?limit=1`, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      latencyMs = Math.round(performance.now() - startTime);

      if (pingRes.ok) {
        testSuccess = true;
      } else if (pingRes.status === 401) {
        testErrorMessage =
          "Authentication failed (HTTP 401). Check the Cloud Server Login and Password shown on your Android device in the sms-gate.app.";
      } else {
        const errData = await pingRes.json().catch(() => null);
        testErrorMessage = errData?.message || errData?.error || `Gateway returned HTTP ${pingRes.status}`;
      }
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : "Network error";
      testErrorMessage = `Cannot reach Gateway at ${baseUrl}: ${msg}. Ensure phone has internet access.`;
    }

    // DO NOT SAVE IF THE CREDENTIAL TEST FAILS
    if (!testSuccess) {
      return NextResponse.json(
        {
          ok: false,
          error: `Gateway Verification Failed! Credentials were NOT saved to database: ${testErrorMessage}`,
        },
        { status: 400 }
      );
    }

    // 2. ONLY SAVED IN DATABASE IF TEST SUCCEEDED
    const configToSave: GatewayConfig = {
      name,
      username,
      password,
      baseUrl,
      deviceId,
      simNumber,
      isVerified: true,
      lastTestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const db = await getDatabase();
    let storage = "local";

    if (db) {
      await db.collection("gateway_credentials").updateOne(
        { username },
        {
          $set: configToSave,
          $setOnInsert: { createdAt: new Date().toISOString() },
        },
        { upsert: true }
      );
      storage = "mongodb";
    }

    return NextResponse.json({
      ok: true,
      storage,
      latency: latencyMs,
      message: `Gateway Credentials "${username}" verified successfully and saved in database!`,
      gateway: configToSave,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process gateway credentials";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json({ error: "Username is required to delete" }, { status: 400 });
    }

    const db = await getDatabase();
    if (db) {
      await db.collection("gateway_credentials").deleteOne({ username });
    }

    return NextResponse.json({ ok: true, message: `Gateway credentials for "${username}" removed.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete gateway credentials";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
