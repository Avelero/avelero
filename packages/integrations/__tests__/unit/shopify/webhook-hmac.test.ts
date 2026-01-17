/**
 * Unit Tests: Shopify Webhook HMAC Verification
 *
 * Tests for verifyShopifyWebhookHmac() function and webhook handling.
 * These tests ensure compliance with Shopify's webhook verification requirements.
 *
 * Shopify webhook verification:
 * - Uses HMAC-SHA256 with the app's client secret
 * - Body is hashed and compared to X-Shopify-Hmac-SHA256 header
 * - Header value is base64-encoded (not hex)
 */

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyShopifyWebhookHmac } from "../../../src/connectors/shopify/oauth";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_CLIENT_SECRET = "test-shopify-client-secret-12345";

/**
 * Generate a valid HMAC signature like Shopify does.
 */
function generateShopifyHmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

/**
 * Sample webhook payloads matching Shopify's format.
 */
const SAMPLE_PAYLOADS = {
  customersDataRequest: JSON.stringify({
    shop_id: 12345,
    shop_domain: "test-store.myshopify.com",
    orders_requested: [1, 2, 3],
    customer: {
      id: 67890,
      email: "customer@example.com",
      phone: "+1234567890",
    },
    data_request: {
      id: 111,
    },
  }),
  customersRedact: JSON.stringify({
    shop_id: 12345,
    shop_domain: "test-store.myshopify.com",
    customer: {
      id: 67890,
      email: "customer@example.com",
      phone: "+1234567890",
    },
    orders_to_redact: [1, 2, 3],
  }),
  shopRedact: JSON.stringify({
    shop_id: 12345,
    shop_domain: "test-store.myshopify.com",
  }),
};

// =============================================================================
// verifyShopifyWebhookHmac() Tests
// =============================================================================

describe("verifyShopifyWebhookHmac()", () => {
  describe("valid HMAC signatures", () => {
    test("accepts valid HMAC for customers/data_request payload", () => {
      const body = SAMPLE_PAYLOADS.customersDataRequest;
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC for customers/redact payload", () => {
      const body = SAMPLE_PAYLOADS.customersRedact;
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC for shop/redact payload", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC for empty body", () => {
      const body = "";
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC for minimal JSON body", () => {
      const body = "{}";
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC with unicode characters in body", () => {
      const body = JSON.stringify({
        shop_domain: "test-store.myshopify.com",
        customer: { name: "日本語テスト", email: "test@例え.jp" },
      });
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });

    test("accepts valid HMAC with special characters in body", () => {
      const body = JSON.stringify({
        description: "Test with special chars: <>&\"'`\\n\\t",
        nested: { emoji: "🎉🔥✨" },
      });
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET);

      expect(result).toBe(true);
    });
  });

  describe("invalid HMAC signatures", () => {
    test("rejects completely wrong HMAC", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const wrongHmac = "completely-invalid-hmac-value";

      const result = verifyShopifyWebhookHmac(
        body,
        wrongHmac,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });

    test("rejects HMAC signed with wrong secret", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmacWithWrongSecret = generateShopifyHmac(body, "wrong-secret");

      const result = verifyShopifyWebhookHmac(
        body,
        hmacWithWrongSecret,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });

    test("rejects HMAC for different body content", () => {
      const originalBody = SAMPLE_PAYLOADS.shopRedact;
      const modifiedBody = JSON.stringify({
        shop_id: 99999, // Different shop_id
        shop_domain: "test-store.myshopify.com",
      });
      const hmacForOriginal = generateShopifyHmac(
        originalBody,
        TEST_CLIENT_SECRET,
      );

      const result = verifyShopifyWebhookHmac(
        modifiedBody,
        hmacForOriginal,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });

    test("rejects empty HMAC", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;

      const result = verifyShopifyWebhookHmac(body, "", TEST_CLIENT_SECRET);

      expect(result).toBe(false);
    });

    test("rejects hex-encoded HMAC (Shopify uses base64)", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      // Generate hex instead of base64
      const hexHmac = createHmac("sha256", TEST_CLIENT_SECRET)
        .update(body, "utf8")
        .digest("hex");

      const result = verifyShopifyWebhookHmac(
        body,
        hexHmac,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });

    test("rejects HMAC with extra whitespace", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const validHmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);
      const hmacWithWhitespace = ` ${validHmac} `;

      const result = verifyShopifyWebhookHmac(
        body,
        hmacWithWhitespace,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });

    test("rejects HMAC with modified character", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const validHmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);
      // Modify one character
      const tamperedHmac = "X" + validHmac.slice(1);

      const result = verifyShopifyWebhookHmac(
        body,
        tamperedHmac,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(false);
    });
  });

  describe("body sensitivity", () => {
    test("whitespace changes in body affect HMAC", () => {
      const body1 = '{"shop_id":12345}';
      const body2 = '{ "shop_id": 12345 }'; // Added spaces
      const hmac1 = generateShopifyHmac(body1, TEST_CLIENT_SECRET);

      // Using body1's HMAC with body2 should fail
      const result = verifyShopifyWebhookHmac(body2, hmac1, TEST_CLIENT_SECRET);

      expect(result).toBe(false);
    });

    test("property order changes affect HMAC", () => {
      const body1 = '{"a":1,"b":2}';
      const body2 = '{"b":2,"a":1}';
      const hmac1 = generateShopifyHmac(body1, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body2, hmac1, TEST_CLIENT_SECRET);

      expect(result).toBe(false);
    });

    test("newline characters in body affect HMAC", () => {
      const body1 = '{"shop_id":12345}';
      const body2 = '{"shop_id":12345}\n';
      const hmac1 = generateShopifyHmac(body1, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(body2, hmac1, TEST_CLIENT_SECRET);

      expect(result).toBe(false);
    });
  });

  describe("secret sensitivity", () => {
    test("different secrets produce different HMACs", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac1 = generateShopifyHmac(body, "secret-1");
      const hmac2 = generateShopifyHmac(body, "secret-2");

      expect(hmac1).not.toBe(hmac2);
    });

    test("empty secret still produces a valid HMAC format", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac = generateShopifyHmac(body, "");

      // Should be valid base64
      expect(() => Buffer.from(hmac, "base64")).not.toThrow();
      expect(verifyShopifyWebhookHmac(body, hmac, "")).toBe(true);
    });

    test("secret with special characters works correctly", () => {
      const specialSecret = "secret-with-$pecial!@#chars";
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac = generateShopifyHmac(body, specialSecret);

      const result = verifyShopifyWebhookHmac(body, hmac, specialSecret);

      expect(result).toBe(true);
    });
  });

  describe("HMAC format", () => {
    test("generated HMAC is base64 encoded", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      // Base64 characters: A-Z, a-z, 0-9, +, /, =
      expect(hmac).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    test("generated HMAC has consistent length", () => {
      // SHA256 produces 32 bytes, base64 encodes to 44 characters (with padding)
      const hmac1 = generateShopifyHmac("body1", TEST_CLIENT_SECRET);
      const hmac2 = generateShopifyHmac("body2", TEST_CLIENT_SECRET);
      const hmac3 = generateShopifyHmac(
        "a much longer body content here",
        TEST_CLIENT_SECRET,
      );

      expect(hmac1.length).toBe(44);
      expect(hmac2.length).toBe(44);
      expect(hmac3.length).toBe(44);
    });
  });

  describe("determinism", () => {
    test("same inputs produce same result across multiple calls", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;
      const hmac = generateShopifyHmac(body, TEST_CLIENT_SECRET);

      const results = [
        verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET),
        verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET),
        verifyShopifyWebhookHmac(body, hmac, TEST_CLIENT_SECRET),
      ];

      expect(results.every((r) => r === true)).toBe(true);
    });

    test("generateShopifyHmac is deterministic", () => {
      const body = SAMPLE_PAYLOADS.shopRedact;

      const hmacs = [
        generateShopifyHmac(body, TEST_CLIENT_SECRET),
        generateShopifyHmac(body, TEST_CLIENT_SECRET),
        generateShopifyHmac(body, TEST_CLIENT_SECRET),
      ];

      expect(new Set(hmacs).size).toBe(1);
    });
  });
});

// =============================================================================
// Compliance Webhook Scenario Tests
// =============================================================================

describe("Shopify Compliance Webhook Scenarios", () => {
  describe("customers/data_request", () => {
    test("payload structure matches Shopify format", () => {
      const payload = JSON.parse(SAMPLE_PAYLOADS.customersDataRequest);

      expect(payload).toHaveProperty("shop_id");
      expect(payload).toHaveProperty("shop_domain");
      expect(payload).toHaveProperty("customer");
      expect(payload).toHaveProperty("customer.id");
      expect(payload).toHaveProperty("customer.email");
      expect(payload).toHaveProperty("data_request");
      expect(payload).toHaveProperty("orders_requested");
    });
  });

  describe("customers/redact", () => {
    test("payload structure matches Shopify format", () => {
      const payload = JSON.parse(SAMPLE_PAYLOADS.customersRedact);

      expect(payload).toHaveProperty("shop_id");
      expect(payload).toHaveProperty("shop_domain");
      expect(payload).toHaveProperty("customer");
      expect(payload).toHaveProperty("customer.id");
      expect(payload).toHaveProperty("customer.email");
      expect(payload).toHaveProperty("orders_to_redact");
    });
  });

  describe("shop/redact", () => {
    test("payload structure matches Shopify format", () => {
      const payload = JSON.parse(SAMPLE_PAYLOADS.shopRedact);

      expect(payload).toHaveProperty("shop_id");
      expect(payload).toHaveProperty("shop_domain");
    });

    test("minimal payload is accepted", () => {
      // shop/redact has the simplest payload
      const minimalPayload = JSON.stringify({
        shop_id: 1,
        shop_domain: "x.myshopify.com",
      });
      const hmac = generateShopifyHmac(minimalPayload, TEST_CLIENT_SECRET);

      const result = verifyShopifyWebhookHmac(
        minimalPayload,
        hmac,
        TEST_CLIENT_SECRET,
      );

      expect(result).toBe(true);
    });
  });
});
