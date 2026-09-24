import { formatPakistaniPhone } from "./utils";


export interface SMSResult {
  success: boolean;
  provider: string;
  messageId?: string;
  state?: string;
  recipientState?: string;
  error?: string;
}

export type SMSProvider = "smsgate" | "httpsms" | "auto";
async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
export function isSMSGateConfigured(): boolean {
  return Boolean(process.env.SMSGATE_USERNAME && process.env.SMSGATE_PASSWORD);
}

async function sendViaSMSGate(
  phone: string,
  message: string,
): Promise<SMSResult> {
  try {
    const apiUrl =
      process.env.SMSGATE_API_URL || "https://api.sms-gate.app/3rdparty/v1";

    const username = process.env.SMSGATE_USERNAME;

    const password = process.env.SMSGATE_PASSWORD;

    const deviceId = process.env.SMSGATE_DEVICE_ID;

    const simNumber = Number(process.env.SMSGATE_SIM_NUMBER || "1");

    if (!username || !password) {
      return {
        success: false,
        provider: "smsgate",
        error: "SMSGate is not configured",
      };
    }

    const formattedPhone = formatPakistaniPhone(phone);

    if (!formattedPhone) {
      return {
        success: false,
        provider: "smsgate",
        error: "Invalid Pakistani phone number",
      };
    }

    if (!message?.trim()) {
      return {
        success: false,
        provider: "smsgate",
        error: "SMS message cannot be empty",
      };
    }

    const credentials = Buffer.from(`${username}:${password}`).toString(
      "base64",
    );

    const payload: Record<string, unknown> = {
      phoneNumbers: [formattedPhone],

      textMessage: {
        text: message.trim(),
      },

      // Request delivery report.
      withDeliveryReport: true,

      // Expire after 1 hour.
      ttl: 3600,

      // SMSGate priority.
      priority: 100,

      // SIM slot.
      simNumber,
    };

    if (deviceId?.trim()) {
      payload.deviceId = deviceId.trim();
    }

    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",

      headers: {
        Authorization: `Basic ${credentials}`,

        "Content-Type": "application/json",

        Accept: "application/json",
      },

      body: JSON.stringify(payload),

      cache: "no-store",
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      console.error("❌ SMSGate API error:", response.status, data);

      return {
        success: false,
        provider: "smsgate",
        error:
          data?.message ||
          data?.error ||
          `SMSGate returned HTTP ${response.status}`,
      };
    }

    if (!data?.id) {
      return {
        success: false,
        provider: "smsgate",
        error: "SMSGate returned no message ID",
      };
    }

    const recipientState = data?.recipients?.[0]?.state;

    console.log(`✅ SMSGate accepted SMS: ${data.id}`);

    return {
      success: true,

      provider: "smsgate",

      messageId: data.id,

      state: data.state,

      recipientState,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown SMSGate error";

    console.error("❌ SMSGate error:", errorMessage);

    return {
      success: false,
      provider: "smsgate",
      error: errorMessage,
    };
  }
}

// ============================================================
// SMSGATE STATUS
// ============================================================

export async function getSMSGateMessageStatus(
  messageId: string,
): Promise<SMSResult> {
  try {
    const apiUrl =
      process.env.SMSGATE_API_URL || "https://api.sms-gate.app/3rdparty/v1";

    const username = process.env.SMSGATE_USERNAME;

    const password = process.env.SMSGATE_PASSWORD;

    if (!username || !password) {
      return {
        success: false,
        provider: "smsgate",
        messageId,
        error: "SMSGate is not configured",
      };
    }

    if (!messageId) {
      return {
        success: false,
        provider: "smsgate",
        error: "Message ID is required",
      };
    }

    const credentials = Buffer.from(`${username}:${password}`).toString(
      "base64",
    );

    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "GET",

        headers: {
          Authorization: `Basic ${credentials}`,

          Accept: "application/json",
        },

        cache: "no-store",
      },
    );

    const data = await parseResponse(response);

    if (!response.ok) {
      return {
        success: false,
        provider: "smsgate",
        messageId,
        error:
          data?.message ||
          data?.error ||
          `SMSGate returned HTTP ${response.status}`,
      };
    }

    return {
      success: true,

      provider: "smsgate",

      messageId: data?.id || messageId,

      state: data?.state,

      recipientState: data?.recipients?.[0]?.state,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to check SMSGate status";

    return {
      success: false,
      provider: "smsgate",
      messageId,
      error: errorMessage,
    };
  }
}


export async function sendSMS(
  phone: string,
  message: string,
  provider: SMSProvider = "auto",
): Promise<SMSResult> {
  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!phone?.trim()) {
    return {
      success: false,
      provider,
      error: "Phone number is required",
    };
  }

  if (!message?.trim()) {
    return {
      success: false,
      provider,
      error: "SMS message is required",
    };
  }

  // ==========================================================
  // SPECIFIC PROVIDER
  // ==========================================================

  if (provider !== "auto") {
    switch (provider) {
      case "smsgate":
        return sendViaSMSGate(phone, message);

     

      default:
        return {
          success: false,
          provider,
          error: "Unsupported SMS provider",
        };
    }
  }



  const providers: Array<{
    name: SMSProvider;

    fn: (phone: string, message: string) => Promise<SMSResult>;

    configured: boolean;
  }> = [
    {
      name: "smsgate",

      fn: sendViaSMSGate,

      configured: isSMSGateConfigured(),
    },

   
  ];

  // ==========================================================
  // PROVIDER LOOP
  // ==========================================================

  for (const providerConfig of providers) {
    // Skip providers that aren't configured.
    if (!providerConfig.configured) {
      continue;
    }

    console.log(`📤 Trying SMS provider: ${providerConfig.name}`);

    const result = await providerConfig.fn(phone, message);

    // ========================================================
    // SUCCESS
    //
    // STOP LOOP IMMEDIATELY.
    // No second SMS will be sent.
    // ========================================================

    if (result.success) {
      console.log(`✅ SMS successfully accepted by ${providerConfig.name}`);

      return result;
    }

    // ========================================================
    // FAILURE
    //
    // Continue to the next provider.
    // ========================================================

    console.warn(`⚠️ ${providerConfig.name} failed: ${result.error}`);
  }

  // ==========================================================
  // ALL PROVIDERS FAILED
  // ==========================================================

  return {
    success: false,

    provider: "auto",

    error: "All configured SMS providers failed",
  };
}