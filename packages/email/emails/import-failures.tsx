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
  /** Number of products that had issues (blocked + warnings) */
  issueProductCount: number;
  /** Number of products that were successfully imported without issues */
  successfulProductCount: number;
  downloadUrl: string;
  expiresAt: string; // ISO string
  filename: string;
}

export default function ImportFailuresEmail({
  issueProductCount,
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

  const hasSuccesses = successfulProductCount > 0;

  const getSummaryText = () => {
    return (
      <>
        Your import of <strong>{filename}</strong> completed with issues.{" "}
        <strong className="text-red-600">
          {issueProductCount.toLocaleString()} product
          {issueProductCount !== 1 ? "s" : ""}
        </strong>{" "}
        had errors that need to be corrected.
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
  };

  const previewText = `${issueProductCount} product${issueProductCount !== 1 ? "s" : ""} had issues during your import`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Your import completed with issues
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
  issueProductCount: 23,
  successfulProductCount: 134,
  downloadUrl: "https://storage.example.com/corrections/download?token=abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  filename: "product-import-2026-01-11.xlsx",
};
