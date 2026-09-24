/**
 * SMS Text, URL Processing, and GSM-7 / UCS-2 Encoding Engine
 */

export interface SMSAttributeInfo {
  charCount: number;
  segments: number;
  encoding: "GSM-7" | "UCS-2 (Unicode)";
  maxCharsPerSegment: number;
  remainingInCurrentSegment: number;
  hasUnicode: boolean;
  detectedUrls: string[];
}

/**
 * Common GSM 7-bit default alphabet + extension set characters.
 */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENSION = "^{}\\[~]|€";

/**
 * Checks if a string contains only GSM-7 characters.
 */
export function isGSM7String(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!GSM7_BASIC.includes(char) && !GSM7_EXTENSION.includes(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Extract all URLs from a given message text.
 * Matches http, https, wa.me, bit.ly, and standard domain formats.
 */
export function extractUrls(text: string): string[] {
  // Regex to match URLs including protocols, domain patterns, and query params
  const urlRegex =
    /(https?:\/\/[^\s<>"{}|\\^`]+|(?:www\.)[^\s<>"{}|\\^`]+|wa\.me\/[0-9+]+|(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl)\/[^\s<>"{}|\\^`]+)/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches));
}

/**
 * Normalize and ensure URL has a valid protocol for clicking
 */
export function ensureHttpUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("wa.me/")) {
    return `https://${url}`;
  }
  return `https://${url}`;
}

/**
 * Calculate detailed SMS segments, character limits, and encoding.
 * 
 * Standards:
 * - GSM-7:
 *   - 1 segment: 160 characters
 *   - Multi-segment: 153 characters per segment (7 characters used for UDH headers)
 *   - Extended chars (^{}\[~]|€) count as 2 septets
 * - UCS-2 (Unicode - Urdu, Emojis, Arabic):
 *   - 1 segment: 70 characters
 *   - Multi-segment: 67 characters per segment (3 characters used for UDH headers)
 */
export function calculateSMSAttributes(text: string): SMSAttributeInfo {
  const detectedUrls = extractUrls(text);
  if (!text || text.length === 0) {
    return {
      charCount: 0,
      segments: 0,
      encoding: "GSM-7",
      maxCharsPerSegment: 160,
      remainingInCurrentSegment: 160,
      hasUnicode: false,
      detectedUrls,
    };
  }

  const isGsm = isGSM7String(text);
  const encoding = isGsm ? "GSM-7" : "UCS-2 (Unicode)";
  const hasUnicode = !isGsm;

  let effectiveLength = 0;
  if (isGsm) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (GSM7_EXTENSION.includes(char)) {
        effectiveLength += 2; // Extension characters count as 2
      } else {
        effectiveLength += 1;
      }
    }
  } else {
    // UTF-16 code units / characters
    effectiveLength = Array.from(text).length;
  }

  const singleLimit = isGsm ? 160 : 70;
  const multiLimit = isGsm ? 153 : 67;

  let segments = 1;
  let remainingInCurrentSegment = singleLimit - effectiveLength;

  if (effectiveLength > singleLimit) {
    segments = Math.ceil(effectiveLength / multiLimit);
    const usedInLastSegment = effectiveLength % multiLimit || multiLimit;
    remainingInCurrentSegment = multiLimit - usedInLastSegment;
  }

  return {
    charCount: effectiveLength,
    segments,
    encoding,
    maxCharsPerSegment: segments > 1 ? multiLimit : singleLimit,
    remainingInCurrentSegment,
    hasUnicode,
    detectedUrls,
  };
}

/**
 * Replace placeholders like {name}, {url}, {phone}, {operator} in a template string.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const val = variables[key];
    return val !== undefined && val !== null ? String(val) : match;
  });
}

/**
 * Build a WhatsApp direct click-to-chat URL for Pakistan numbers
 */
export function buildWhatsAppLink(phone: string, prefillMessage?: string): string {
  let cleanDigits = phone.replace(/\D/g, "");
  if (cleanDigits.startsWith("0")) {
    cleanDigits = "92" + cleanDigits.substring(1);
  }
  const encodedMsg = prefillMessage ? `?text=${encodeURIComponent(prefillMessage)}` : "";
  return `https://wa.me/${cleanDigits}${encodedMsg}`;
}

/**
 * Append UTM tracking tags to a URL cleanly
 */
export function appendUtmTags(
  url: string,
  tags: { source?: string; medium?: string; campaign?: string }
): string {
  try {
    const fullUrl = ensureHttpUrl(url);
    const parsed = new URL(fullUrl);
    if (tags.source) parsed.searchParams.set("utm_source", tags.source);
    if (tags.medium) parsed.searchParams.set("utm_medium", tags.medium);
    if (tags.campaign) parsed.searchParams.set("utm_campaign", tags.campaign);
    return parsed.toString();
  } catch {
    return url;
  }
}
