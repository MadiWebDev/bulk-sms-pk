// lib/utils.ts - Shared notification & phone formatting utilities
import { validatePakistanPhone } from "./pakistan-phone";

/**
 * Format phone number to Pakistani standard (+92XXXXXXXXXX)
 * Strictly ensures it is a valid Pakistani mobile number. Returns empty string if invalid.
 */
export function formatPakistaniPhone(phone: string): string {
  const result = validatePakistanPhone(phone);
  return result.isValid && result.e164 ? result.e164 : "";
}

/**
 * Format phone number for WhatsApp (92XXXXXXXXXX - no plus for some APIs)
 */
export function formatWhatsAppPhone(phone: string): string {
  const formatted = formatPakistaniPhone(phone);
  return formatted.replace("+", "");
}

export * from "./pakistan-phone";
export * from "./sms-text";
