/**
 * Integration Tests: QR Export Pipeline (query + generation flow)
 */

import "../../setup";

import { describe, expect, it } from "bun:test";
import {
  getQrExportVariantRows,
  resolveQrExportProductIds,
} from "@v1/db/queries/products";
import {
  createTestBrand,
  createTestProductForExport,
  createTestVariantWithOverrides,
  testDb,
} from "@v1/db/testing";
import {
  buildGs1DigitalLink,
  generateQrExportCsv,
  generateQrPng,
} from "../../../src/lib/qr-export";
import type { QrExportCsvRow } from "../../../src/lib/qr-export";

describe("QR Export pipeline flow", () => {
  it("exports only barcode-eligible variants and produces valid CSV/PNG artifacts", async () => {
    const brandId = await createTestBrand("QR Export Pipeline Brand");
    const productId = await createTestProductForExport(brandId, {
      name: "Pipeline Product",
    });

    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-001",
      barcode: "1234567890123",
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-002",
      barcode: "2234567890123",
    });
    await createTestVariantWithOverrides(productId, brandId, {
      upid: "UPID-003",
      barcode: "",
    });

    const productIds = await resolveQrExportProductIds(testDb, brandId, {
      selectionMode: "explicit",
      includeIds: [productId],
      excludeIds: [],
    });

    const rows = await getQrExportVariantRows(testDb, brandId, productIds);
    expect(rows.length).toBe(2);
    expect(rows.every((row) => row.barcode.trim().length > 0)).toBe(true);

    const csvRows: QrExportCsvRow[] = [];
    for (const row of rows) {
      const gs1Url = buildGs1DigitalLink("passport.example.com", row.barcode);
      const png = await generateQrPng(gs1Url);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );

      csvRows.push({
        productTitle: row.productTitle,
        variantUpid: row.variantUpid,
        barcode: row.barcode,
        gs1DigitalLinkUrl: gs1Url,
        qrPngUrl: `https://cdn.example.com/${row.variantId}.png`,
      });
    }

    const csv = generateQrExportCsv(csvRows);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(
      "product_title,variant_upid,barcode,gs1_digital_link_url,qr_png_url",
    );
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it("keeps GTIN-14 barcodes unchanged in GS1 URLs", () => {
    const gtin14 = "01234567890123";
    const url = buildGs1DigitalLink("passport.example.com", gtin14);
    expect(url).toBe(`https://passport.example.com/01/${gtin14}`);
  });
});
