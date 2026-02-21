import { createHash } from "node:crypto";
import QRCode from "qrcode";

const DEFAULT_QR_WIDTH = 1024;
const PRINT_QR_WIDTH = 2048;
const DEFAULT_QR_MARGIN = 1;
const DEFAULT_QR_ERROR_CORRECTION_LEVEL = "H" as const;
const QR_CACHE_KEY_VERSION = "v2";

export type QrImageQuality = "standard" | "print";

export const QR_EXPORT_CSV_HEADER = [
  "product_title",
  "variant_upid",
  "barcode",
  "gs1_digital_link_url",
  "qr_png_url",
] as const;

export interface QrExportCsvRow {
  productTitle: string;
  variantUpid: string | null;
  barcode: string;
  gs1DigitalLinkUrl: string;
  qrPngUrl: string;
}

export interface GenerateQrPngOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

/**
 * Builds the GS1 Digital Link URL in the required format.
 */
export function buildGs1DigitalLink(domain: string, barcode: string): string {
  return `https://${normalizeDomain(domain)}/01/${barcode}`;
}

/**
 * Generates a high-resolution PNG QR code buffer.
 */
export async function generateQrPng(
  data: string,
  options: GenerateQrPngOptions = {},
): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: "png",
    width: options.width ?? DEFAULT_QR_WIDTH,
    margin: options.margin ?? DEFAULT_QR_MARGIN,
    errorCorrectionLevel:
      options.errorCorrectionLevel ?? DEFAULT_QR_ERROR_CORRECTION_LEVEL,
  });
}

/**
 * Resolves image width for QR export quality presets.
 */
export function getQrWidthForQuality(quality: QrImageQuality): number {
  return quality === "print" ? PRINT_QR_WIDTH : DEFAULT_QR_WIDTH;
}

/**
 * Builds a deterministic cache filename for QR PNG reuse across exports.
 * Includes domain, barcode, and rendering options to prevent stale cache collisions.
 */
export function buildQrPngCacheFilename(
  domain: string,
  barcode: string,
  options: GenerateQrPngOptions = {},
): string {
  const width = options.width ?? DEFAULT_QR_WIDTH;
  const margin = options.margin ?? DEFAULT_QR_MARGIN;
  const errorCorrectionLevel =
    options.errorCorrectionLevel ?? DEFAULT_QR_ERROR_CORRECTION_LEVEL;
  const key = [
    QR_CACHE_KEY_VERSION,
    normalizeDomain(domain),
    barcode.trim(),
    String(width),
    String(margin),
    errorCorrectionLevel,
  ].join("|");
  const digest = createHash("sha256").update(key).digest("hex");
  return `${digest}.png`;
}

/**
 * Escapes a single CSV field according to RFC4180 rules.
 */
export function escapeCsvField(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * Generates RFC4180-compliant CSV content for QR export rows.
 */
export function generateQrExportCsv(rows: QrExportCsvRow[]): string {
  const lines = [QR_EXPORT_CSV_HEADER.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.productTitle,
        row.variantUpid ?? "",
        row.barcode,
        row.gs1DigitalLinkUrl,
        row.qrPngUrl,
      ]
        .map((field) => escapeCsvField(field))
        .join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}
