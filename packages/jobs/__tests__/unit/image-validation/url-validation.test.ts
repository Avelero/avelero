/**
 * Unit Tests: Image URL Validation
 *
 * Tests the image URL validation logic.
 * Image values must ALWAYS be full HTTP/HTTPS URLs.
 * Storage paths are NOT valid user input.
 *
 * @module tests/unit/image-validation/url-validation
 */

import { describe, expect, it } from "bun:test";
import { validateImageUrl } from "@v1/supabase/utils/external-images";

describe("validateImageUrl", () => {
  // ============================================================================
  // Valid URLs (only HTTP/HTTPS allowed)
  // ============================================================================

  describe("valid URLs (only HTTP/HTTPS allowed)", () => {
    it("C1: accepts valid HTTPS URL", () => {
      const result = validateImageUrl("https://example.com/image.jpg");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("C2: accepts valid HTTP URL", () => {
      const result = validateImageUrl("http://example.com/image.jpg");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("C-EC1: accepts URL with query parameters", () => {
      const result = validateImageUrl(
        "https://example.com/image.jpg?v=1&size=large",
      );
      expect(result.valid).toBe(true);
    });

    it("C-EC2: accepts URL with fragments", () => {
      const result = validateImageUrl("https://example.com/image.jpg#section");
      expect(result.valid).toBe(true);
    });

    it("C-EC3: accepts URL with encoded characters", () => {
      const result = validateImageUrl("https://example.com/my%20image.jpg");
      expect(result.valid).toBe(true);
    });

    it("C-EC4: accepts URL with port number", () => {
      const result = validateImageUrl("https://example.com:8080/image.jpg");
      expect(result.valid).toBe(true);
    });

    it("C-EC5: accepts very long URLs", () => {
      const longPath = "a".repeat(2000);
      const result = validateImageUrl(`https://example.com/${longPath}.jpg`);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Invalid - storage paths (must be full URL)
  // ============================================================================

  describe("invalid - storage paths (must be full URL)", () => {
    it("C3: rejects storage path (brand-id/image.jpg)", () => {
      const result = validateImageUrl("brand-id/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C4: rejects nested storage path (folder/subfolder/image.png)", () => {
      const result = validateImageUrl("folder/subfolder/image.png");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C5: rejects partial storage URL (v1/object/...)", () => {
      const result = validateImageUrl("v1/object/public/images/img.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C-EC6: rejects just filename (image.jpg)", () => {
      const result = validateImageUrl("image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });
  });

  // ============================================================================
  // Invalid - malformed URLs
  // ============================================================================

  describe("invalid - malformed URLs", () => {
    it("C6: rejects non-http protocols (ftp://)", () => {
      const result = validateImageUrl("ftp://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("http://");
    });

    it("C7: rejects malformed protocol (htp://)", () => {
      const result = validateImageUrl("htp://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C8: rejects missing colon (http//)", () => {
      const result = validateImageUrl("http//example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C9: rejects domain without protocol (example.com/img.jpg)", () => {
      const result = validateImageUrl("example.com/img.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C10: rejects random text", () => {
      const result = validateImageUrl("not-a-valid-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C-EC7: rejects Windows paths", () => {
      const result = validateImageUrl("C:\\folder\\image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a full URL");
    });

    it("C-EC9: rejects data URLs", () => {
      const result = validateImageUrl(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("data URLs");
    });
  });

  // ============================================================================
  // Skip validation
  // ============================================================================

  describe("skip validation", () => {
    it("C11: skips validation for empty string", () => {
      const result = validateImageUrl("");
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("C12: skips validation for whitespace only", () => {
      const result = validateImageUrl("   ");
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("skips validation for null/undefined", () => {
      expect(validateImageUrl(null as unknown as string).skipped).toBe(true);
      expect(validateImageUrl(undefined as unknown as string).skipped).toBe(
        true,
      );
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("edge cases", () => {
    it("handles URL with authentication", () => {
      const result = validateImageUrl(
        "https://user:pass@example.com/image.jpg",
      );
      expect(result.valid).toBe(true);
    });

    it("handles localhost URLs", () => {
      const result = validateImageUrl("http://localhost:3000/image.jpg");
      expect(result.valid).toBe(true);
    });

    it("handles IP address URLs", () => {
      const result = validateImageUrl("http://192.168.1.1/image.jpg");
      expect(result.valid).toBe(true);
    });

    it("handles S3/cloud storage URLs correctly", () => {
      const result = validateImageUrl(
        "https://my-bucket.s3.amazonaws.com/images/product.jpg",
      );
      expect(result.valid).toBe(true);
    });

    it("handles Supabase storage URLs correctly", () => {
      const result = validateImageUrl(
        "https://project.supabase.co/storage/v1/object/public/images/product.jpg",
      );
      expect(result.valid).toBe(true);
    });
  });
});
