import { parsePhoneNumberFromString } from "libphonenumber-js";
import validator from "validator";

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Check for http/https schemes case-insensitively
  const lowerTrimmed = trimmed.toLowerCase();
  if (
    lowerTrimmed.startsWith("http://") ||
    lowerTrimmed.startsWith("https://")
  ) {
    return validator.isURL(trimmed) ? trimmed : "";
  }

  const withProtocol = `https://${trimmed}`;
  return validator.isURL(withProtocol) ? withProtocol : "";
}

export function isValidUrl(url: string): boolean {
  if (!url.trim()) return true;
  return normalizeUrl(url).length > 0;
}

export function isValidEmail(email: string): boolean {
  if (!email.trim()) return true;
  return validator.isEmail(email.trim());
}

export function validatePhone(phone: string): {
  isValid: boolean;
  formatted?: string;
  error?: string;
} {
  const trimmed = phone.trim();
  if (!trimmed) return { isValid: true };

  try {
    const phoneNumber = parsePhoneNumberFromString(trimmed);
    if (phoneNumber?.isValid()) {
      return { isValid: true, formatted: phoneNumber.formatInternational() };
    }
    return { isValid: false, error: "Invalid phone number format" };
  } catch {
    return {
      isValid: false,
      error:
        "Please enter a valid phone number with country code (e.g., +1 234 567 8900)",
    };
  }
}

export function formatPhone(phone: string): string {
  return validatePhone(phone).formatted || phone;
}
