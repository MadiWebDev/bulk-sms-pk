import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const username = process.env.SMSGATE_USERNAME || "";
  const hasPassword = Boolean(process.env.SMSGATE_PASSWORD);
  const deviceId = process.env.SMSGATE_DEVICE_ID || "";
  const simNumber = process.env.SMSGATE_SIM_NUMBER || "1";
  const baseUrl = process.env.SMS_GATE_BASE_URL || "https://api.sms-gate.app/3rdparty/v1";

  const maskedUsername = username
    ? username.length > 3
      ? username.substring(0, 2) + "***" + username.substring(username.length - 1)
      : "***"
    : "";

  return NextResponse.json({
    isConfigured: Boolean(username && hasPassword),
    hasEnvCredentials: Boolean(username && hasPassword),
    maskedUsername,
    deviceId,
    simNumber: Number(simNumber) || 1,
    baseUrl,
  });
}
