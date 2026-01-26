/**
 * Unit Tests: Barcode Schema Validation
 *
 * Tests the Zod validation schemas for barcode management:
 * - barcodeSchema: GS1 GTIN format validation (8, 12, 13, 14 digits)
 * - normalizeBarcode: Whitespace trimming and empty handling
 * - normalizeToGtin14: GTIN-14 padding for storage
 *
 * Following TDD principles - tests define expected behavior.
 */

import { describe, expect, it } from "bun:test";
import {
  barcodeSchema,
  normalizeBarcode,
  normalizeToGtin14,
} from "../../../src/schemas/_shared/primitives";

describe("barcodeSchema", () => {
  describe("valid formats", () => {
    it("accepts 8-digit GTIN-8", () => {
      const result = barcodeSchema.safeParse("12345678");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("12345678");
      }
    });

    it("accepts 12-digit GTIN-12/UPC", () => {
      const result = barcodeSchema.safeParse("123456789012");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("123456789012");
      }
    });

    it("accepts 13-digit GTIN-13/EAN", () => {
      const result = barcodeSchema.safeParse("1234567890123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("1234567890123");
      }
    });

    it("accepts 14-digit GTIN-14", () => {
      const result = barcodeSchema.safeParse("12345678901234");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("12345678901234");
      }
    });

    it("accepts undefined (optional)", () => {
      const result = barcodeSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it("accepts barcode with all zeros", () => {
      const result = barcodeSchema.safeParse("00000000");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("00000000");
      }
    });

    it("accepts barcode starting with zeros", () => {
      const result = barcodeSchema.safeParse("0012345678901");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("0012345678901");
      }
    });
  });

  describe("invalid formats", () => {
    it("rejects 7-digit string", () => {
      const result = barcodeSchema.safeParse("1234567");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          "8, 12, 13, or 14 digits",
        );
      }
    });

    it("rejects 9-digit string", () => {
      const result = barcodeSchema.safeParse("123456789");
      expect(result.success).toBe(false);
    });

    it("rejects 10-digit string", () => {
      const result = barcodeSchema.safeParse("1234567890");
      expect(result.success).toBe(false);
    });

    it("rejects 11-digit string", () => {
      const result = barcodeSchema.safeParse("12345678901");
      expect(result.success).toBe(false);
    });

    it("rejects 15-digit string", () => {
      const result = barcodeSchema.safeParse("123456789012345");
      expect(result.success).toBe(false);
    });

    it("rejects alphanumeric string", () => {
      const result = barcodeSchema.safeParse("ABC12345678");
      expect(result.success).toBe(false);
    });

    it("rejects string with dashes", () => {
      const result = barcodeSchema.safeParse("1234-5678-9012");
      expect(result.success).toBe(false);
    });

    it("rejects string with spaces", () => {
      const result = barcodeSchema.safeParse("1234 5678 9012");
      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const result = barcodeSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("rejects string with leading/trailing whitespace", () => {
      // The schema expects exact digit format, whitespace should be handled by normalizeBarcode
      const result = barcodeSchema.safeParse("  12345678  ");
      expect(result.success).toBe(false);
    });

    it("rejects string with special characters", () => {
      const result = barcodeSchema.safeParse("12345678!");
      expect(result.success).toBe(false);
    });

    it("rejects string with decimal point", () => {
      const result = barcodeSchema.safeParse("123456.78");
      expect(result.success).toBe(false);
    });
  });
});

describe("normalizeBarcode", () => {
  it("trims whitespace from valid barcode", () => {
    expect(normalizeBarcode("  12345678  ")).toBe("12345678");
  });

  it("returns undefined for empty string", () => {
    expect(normalizeBarcode("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(normalizeBarcode("   ")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizeBarcode(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeBarcode(undefined)).toBeUndefined();
  });

  it("preserves valid barcode", () => {
    expect(normalizeBarcode("1234567890123")).toBe("1234567890123");
  });

  it("trims leading whitespace only", () => {
    expect(normalizeBarcode("  12345678")).toBe("12345678");
  });

  it("trims trailing whitespace only", () => {
    expect(normalizeBarcode("12345678  ")).toBe("12345678");
  });

  it("handles tabs and newlines", () => {
    expect(normalizeBarcode("\t12345678\n")).toBe("12345678");
  });
});

describe("normalizeToGtin14", () => {
  it("pads 8-digit barcode to 14 digits with 6 leading zeros", () => {
    expect(normalizeToGtin14("12345678")).toBe("00000012345678");
  });

  it("pads 12-digit barcode to 14 digits with 2 leading zeros", () => {
    expect(normalizeToGtin14("123456789012")).toBe("00123456789012");
  });

  it("pads 13-digit barcode to 14 digits with 1 leading zero", () => {
    expect(normalizeToGtin14("1234567890123")).toBe("01234567890123");
  });

  it("returns 14-digit barcode as-is", () => {
    expect(normalizeToGtin14("12345678901234")).toBe("12345678901234");
  });

  it("preserves leading zeros in original barcode", () => {
    expect(normalizeToGtin14("00123456")).toBe("00000000123456");
  });

  it("handles barcode starting with zeros", () => {
    expect(normalizeToGtin14("0012345678901")).toBe("00012345678901");
  });

  it("handles all-zeros barcode", () => {
    expect(normalizeToGtin14("00000000")).toBe("00000000000000");
  });
});
