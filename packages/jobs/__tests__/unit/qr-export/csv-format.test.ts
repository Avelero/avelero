/**
 * Unit Tests: QR Export CSV Format
 */

import { describe, expect, it } from "bun:test";
import {
  QR_EXPORT_CSV_HEADER,
  buildGs1DigitalLink,
  generateQrExportCsv,
  generateQrPng,
} from "../../../src/lib/qr-export";

describe("QR export CSV helpers", () => {
  it("uses exact required header order", () => {
    expect(QR_EXPORT_CSV_HEADER.join(",")).toBe(
      "product_title,variant_upid,barcode,gs1_digital_link_url,qr_png_url",
    );
  });

  it("builds GS1 URL in exact required format", () => {
    const url = buildGs1DigitalLink("passport.example.com", "01234567890123");
    expect(url).toBe("https://passport.example.com/01/01234567890123");
  });

  it("writes empty variant_upid when variant UPID is missing", () => {
    const csv = generateQrExportCsv([
      {
        productTitle: "Product A",
        variantUpid: null,
        barcode: "1234567890123",
        gs1DigitalLinkUrl: "https://passport.example.com/01/1234567890123",
        qrPngUrl: "https://cdn.example.com/qr.png",
      },
    ]);

    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain("Product A,,1234567890123,");
  });

  it("escapes commas, quotes, and newlines per RFC4180", () => {
    const csv = generateQrExportCsv([
      {
        productTitle: 'Title, "quoted"\nline',
        variantUpid: "UPID-1",
        barcode: "1234567890123",
        gs1DigitalLinkUrl: "https://passport.example.com/01/1234567890123",
        qrPngUrl: "https://cdn.example.com/qr.png",
      },
    ]);

    expect(csv).toContain('"Title, ""quoted""\nline"');
  });

  it("generates PNG output", async () => {
    const png = await generateQrPng("https://passport.example.com/01/12345");
    expect(png.length).toBeGreaterThan(100);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });
});
