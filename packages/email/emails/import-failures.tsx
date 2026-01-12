import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface ImportFailuresEmailProps {
  /** Number of products that were completely blocked from import */
  blockedProductCount: number;
  /** Number of products that were imported but had field warnings */
  warningProductCount: number;
  /** Number of products that were successfully imported without issues */
  successfulProductCount: number;
  downloadUrl: string;
  expiresAt: string; // ISO string
  filename: string;
}

export default function ImportFailuresEmail({
  blockedProductCount,
  warningProductCount,
  successfulProductCount,
  downloadUrl,
  expiresAt,
  filename,
}: ImportFailuresEmailProps) {
  const expiryDate = new Date(expiresAt);
  const expiryText = expiryDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalIssues = blockedProductCount + warningProductCount;
  const hasSuccesses = successfulProductCount > 0;
  const hasBlocked = blockedProductCount > 0;
  const hasWarnings = warningProductCount > 0;

  // Build summary text based on what issues exist
  const getSummaryText = () => {
    if (hasBlocked && hasWarnings) {
      return (
        <>
          Your import of <strong>{filename}</strong> completed with issues.{" "}
          <strong className="text-red-600">
            {blockedProductCount.toLocaleString()} product
            {blockedProductCount !== 1 ? "s" : ""}
          </strong>{" "}
          failed to import due to critical errors, and{" "}
          <strong className="text-orange-600">
            {warningProductCount.toLocaleString()} product
            {warningProductCount !== 1 ? "s" : ""}
          </strong>{" "}
          were imported with warnings.
          {hasSuccesses && (
            <>
              {" "}
              <strong className="text-green-600">
                {successfulProductCount.toLocaleString()} product
                {successfulProductCount !== 1 ? "s" : ""}
              </strong>{" "}
              were successfully imported without issues.
            </>
          )}
        </>
      );
    }

    if (hasBlocked) {
      return (
        <>
          Your import of <strong>{filename}</strong> completed, but{" "}
          <strong className="text-red-600">
            {blockedProductCount.toLocaleString()} product
            {blockedProductCount !== 1 ? "s" : ""}
          </strong>{" "}
          failed to import due to critical errors.
          {hasSuccesses && (
            <>
              {" "}
              <strong className="text-green-600">
                {successfulProductCount.toLocaleString()} product
                {successfulProductCount !== 1 ? "s" : ""}
              </strong>{" "}
              were successfully imported.
            </>
          )}
        </>
      );
    }

    // Only warnings (all were imported, but with issues)
    return (
      <>
        Your import of <strong>{filename}</strong> completed successfully, but{" "}
        <strong className="text-orange-600">
          {warningProductCount.toLocaleString()} product
          {warningProductCount !== 1 ? "s" : ""}
        </strong>{" "}
        had field validation warnings. These products were imported, but some
        fields may not have been set correctly.
        {hasSuccesses && (
          <>
            {" "}
            <strong className="text-green-600">
              {successfulProductCount.toLocaleString()} product
              {successfulProductCount !== 1 ? "s" : ""}
            </strong>{" "}
            were imported without any issues.
          </>
        )}
      </>
    );
  };

  const previewText = hasBlocked
    ? `${blockedProductCount} products failed during your import`
    : `${warningProductCount} products had warnings during your import`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              {hasBlocked
                ? "Your import completed with errors"
                : "Your import completed with warnings"}
            </Heading>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">{getSummaryText()}</Text>
            </Section>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                Download the error report to see which products need
                corrections. The problematic cells are highlighted in red so you
                can quickly identify and fix the issues.
              </Text>
            </Section>

            <Section className="mb-6 text-center">
              <a
                href={downloadUrl}
                className="inline-block rounded-md bg-black text-white px-4 py-3 text-sm font-medium"
              >
                Download Error Report
              </a>
            </Section>

            <Section className="mb-6 text-center">
              <Text className="text-neutral-500 text-sm">
                This download link will expire on {expiryText}.
              </Text>
            </Section>

            <Hr />
            <Section className="mt-4 text-center">
              <Text className="text-xs text-neutral-500">
                This email was sent by Avelero. You received this because you
                started a product import that completed with issues.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: ImportFailuresEmailProps = {
  blockedProductCount: 5,
  warningProductCount: 18,
  successfulProductCount: 134,
  downloadUrl: "https://storage.example.com/corrections/download?token=abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  filename: "product-import-2026-01-11.xlsx",
};
