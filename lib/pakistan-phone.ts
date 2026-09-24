/**
 * Pakistan Phone Number Validation, Normalization and Operator Detection Engine
 * 
 * Pakistan Mobile Number Structure:
 * - Country Code: +92
 * - Mobile Operator Codes: 300-349, 355
 * - Subscriber Number: 7 digits
 * - Standard International Format (E.164): +923XXXXXXXXX (total 12 characters including +)
 * - Standard Local Format: 03XXXXXXXXX (total 11 digits)
 */

export type PakistanOperator = "Jazz" | "Zong" | "Ufone" | "Telenor" | "SCOM" | "Unknown";

export interface PakistanPhoneValidation {
  raw: string;
  isValid: boolean;
  e164?: string; // e.g. +923001234567
  national?: string; // e.g. 0300 1234567
  operator?: PakistanOperator;
  operatorPrefix?: string; // e.g. 0300
  reason?: string;
}

export interface BatchPhoneValidationResult {
  valid: PakistanPhoneValidation[];
  excluded: PakistanPhoneValidation[];
  duplicatesCount: number;
  operatorStats: Record<PakistanOperator, number>;
}

/**
 * Identify Pakistan mobile network operator from the 4-digit national prefix (03xx)
 */
export function detectPakistanOperator(prefix: string): PakistanOperator {
  const code = parseInt(prefix.replace(/\D/g, ""), 10);
  
  // Jazz / Mobilink (0300-0309) & Warid (0320-0329)
  if ((code >= 300 && code <= 309) || (code >= 320 && code <= 329)) {
    return "Jazz";
  }
  
  // Zong / CMPak (0310-0319)
  if (code >= 310 && code <= 319) {
    return "Zong";
  }
  
  // Ufone (0330-0337, 0339)
  if ((code >= 330 && code <= 337) || code === 339) {
    return "Ufone";
  }
  
  // Telenor (0340-0349)
  if (code >= 340 && code <= 349) {
    return "Telenor";
  }
  
  // SCOM - Special Communications Organization (Azad Kashmir & Gilgit-Baltistan)
  if (code === 355) {
    return "SCOM";
  }
  
  return "Unknown";
}

/**
 * Strictly validate and normalize a single phone number to Pakistani mobile standard
 */
export function validatePakistanPhone(input: string): PakistanPhoneValidation {
  const raw = input.trim();
  if (!raw) {
    return { raw, isValid: false, reason: "Empty input" };
  }

  // Check for foreign country codes (e.g. +1, +44, +91, +971, etc.)
  if (raw.startsWith("+") && !raw.startsWith("+92")) {
    const countryCode = raw.match(/^\+(\d{1,4})/)?.[1] || "unknown";
    return {
      raw,
      isValid: false,
      reason: `Foreign number (+${countryCode}). Bulk SMS is restricted strictly to Pakistan (+92) numbers only.`,
    };
  }

  // Remove non-digit characters
  let digits = raw.replace(/\D/g, "");

  // Check if international prefix starts with 00 (e.g. 0092...)
  if (digits.startsWith("0092")) {
    digits = digits.substring(2);
  } else if (digits.startsWith("00")) {
    return {
      raw,
      isValid: false,
      reason: "Foreign country prefix (00). Only Pakistan numbers (+92) are allowed.",
    };
  }

  // Normalize to digits without 92 prefix
  let localDigits = "";
  if (digits.startsWith("92")) {
    localDigits = digits.substring(2);
  } else if (digits.startsWith("0")) {
    localDigits = digits.substring(1);
  } else if (digits.startsWith("3") && digits.length === 10) {
    localDigits = digits;
  } else {
    // If it starts with non-3 and doesn't have 92 or 0
    return {
      raw,
      isValid: false,
      reason: "Invalid format. Pakistani mobile numbers must start with 03xx or +923xx.",
    };
  }

  // Detect Pakistani Landlines (e.g., 051 - Islamabad/Rawalpindi, 021 - Karachi, 042 - Lahore, 091 - Peshawar, 081 - Quetta)
  const landlineCodes = ["51", "21", "42", "91", "81", "61", "41", "52", "55", "71", "992", "48"];
  for (const landline of landlineCodes) {
    if (localDigits.startsWith(landline) && !localDigits.startsWith("3")) {
      return {
        raw,
        isValid: false,
        reason: `Pakistani landline area code (0${landline}). Landlines cannot receive SMS. Please use a mobile number (03xx).`,
      };
    }
  }

  // Pakistan mobile numbers MUST start with '3'
  if (!localDigits.startsWith("3")) {
    return {
      raw,
      isValid: false,
      reason: "Not a mobile number. Pakistani mobile numbers must start with 03xx (e.g., 0300, 0312, 0333, 0345).",
    };
  }

  // Pakistan mobile numbers MUST be exactly 10 digits after the country code / leading 0 (3XXXXXXXXX)
  if (localDigits.length < 10) {
    return {
      raw,
      isValid: false,
      reason: `Number is too short (${localDigits.length} digits). Pakistani mobile numbers require 10 digits after prefix (e.g. 0300-1234567).`,
    };
  }

  if (localDigits.length > 10) {
    return {
      raw,
      isValid: false,
      reason: `Number is too long (${localDigits.length} digits). Valid Pakistani mobile numbers have exactly 10 digits after prefix.`,
    };
  }

  const prefix = "0" + localDigits.substring(0, 3); // e.g. 0300
  const operator = detectPakistanOperator(prefix);

  const e164 = `+92${localDigits}`;
  const national = `0${localDigits.substring(0, 3)} ${localDigits.substring(3)}`;

  return {
    raw,
    isValid: true,
    e164,
    national,
    operator,
    operatorPrefix: prefix,
  };
}

/**
 * Validate and filter a batch of phone numbers.
 * Separates valid Pakistan numbers from excluded/invalid entries, deduplicates, and produces operator stats.
 */
export function validatePakistanPhoneBatch(
  inputs: string[],
  deduplicate: boolean = true
): BatchPhoneValidationResult {
  const valid: PakistanPhoneValidation[] = [];
  const excluded: PakistanPhoneValidation[] = [];
  const seenE164 = new Set<string>();
  let duplicatesCount = 0;

  const operatorStats: Record<PakistanOperator, number> = {
    Jazz: 0,
    Zong: 0,
    Ufone: 0,
    Telenor: 0,
    SCOM: 0,
    Unknown: 0,
  };

  for (const raw of inputs) {
    const cleaned = raw.trim();
    if (!cleaned) continue;

    const res = validatePakistanPhone(cleaned);

    if (res.isValid && res.e164) {
      if (deduplicate && seenE164.has(res.e164)) {
        duplicatesCount++;
        continue;
      }
      seenE164.add(res.e164);
      valid.push(res);
      if (res.operator) {
        operatorStats[res.operator] = (operatorStats[res.operator] || 0) + 1;
      }
    } else {
      excluded.push(res);
    }
  }

  return {
    valid,
    excluded,
    duplicatesCount,
    operatorStats,
  };
}
