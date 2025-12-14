import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption utilities for storing sensitive integration credentials.
 *
 * Uses AES-256-GCM (authenticated encryption) with a random IV per encryption.
 * The encryption key should be stored in INTEGRATION_ENCRYPTION_KEY environment variable.
 *
 * Key generation: `openssl rand -base64 32`
 *
 * @see plan-integration.md for architecture details
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedData {
  /** Encrypted data as base64 string */
  encrypted: string;
  /** Initialization vector as base64 string */
  iv: string;
}

/**
 * Get the encryption key from environment variable.
 * Validates that the key is present and has the correct length.
 *
 * @throws Error if INTEGRATION_ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.INTEGRATION_ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -base64 32",
    );
  }

  const key = Buffer.from(keyBase64, "base64");

  // AES-256 requires a 32-byte key
  if (key.length !== 32) {
    throw new Error(
      `Invalid INTEGRATION_ENCRYPTION_KEY length: expected 32 bytes, got ${key.length}. Generate a new key with: openssl rand -base64 32`,
    );
  }

  return key;
}

/**
 * Encrypt credentials using AES-256-GCM.
 *
 * @param credentials - The credentials object to encrypt (will be JSON stringified)
 * @returns Object containing encrypted data and IV (both as base64 strings)
 *
 * @example
 * ```typescript
 * const { encrypted, iv } = encryptCredentials({ apiKey: "sk_live_xxx" });
 * // Store `encrypted` and `iv` in database
 * ```
 */
export function encryptCredentials(
  credentials: Record<string, unknown>,
): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(credentials);
  const encryptedBuffer = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Append auth tag to encrypted data
  const authTag = cipher.getAuthTag();
  const encryptedWithTag = Buffer.concat([encryptedBuffer, authTag]);

  return {
    encrypted: encryptedWithTag.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt credentials using AES-256-GCM.
 *
 * @param encrypted - The encrypted data (base64 string)
 * @param iv - The initialization vector (base64 string)
 * @returns The decrypted credentials object
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 *
 * @example
 * ```typescript
 * const credentials = decryptCredentials(encrypted, iv);
 * console.log(credentials.apiKey); // "sk_live_xxx"
 * ```
 */
export function decryptCredentials<T = Record<string, unknown>>(
  encrypted: string,
  iv: string,
): T {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, "base64");
  const encryptedWithTag = Buffer.from(encrypted, "base64");

  // Extract auth tag from end of encrypted data
  const authTag = encryptedWithTag.subarray(-AUTH_TAG_LENGTH);
  const encryptedData = encryptedWithTag.subarray(0, -AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return JSON.parse(decryptedBuffer.toString("utf8")) as T;
}

/**
 * Check if encryption is properly configured.
 * Useful for startup validation.
 *
 * @returns true if encryption key is valid, false otherwise
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate encryption by performing a round-trip test.
 * Encrypts and decrypts a test value to ensure configuration is correct.
 *
 * @throws Error if encryption/decryption fails
 */
export function validateEncryption(): void {
  const testData = { test: "validation", timestamp: Date.now() };
  const { encrypted, iv } = encryptCredentials(testData);
  const decrypted = decryptCredentials<typeof testData>(encrypted, iv);

  if (decrypted.test !== testData.test) {
    throw new Error("Encryption validation failed: decrypted data mismatch");
  }
}
