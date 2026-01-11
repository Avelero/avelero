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
  failedProductCount: number;
  successfulProductCount: number;
  downloadUrl: string;
  expiresAt: string; // ISO string
  filename: string;
}

export default function ImportFailuresEmail({
  failedProductCount,
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

  const totalProducts = failedProductCount + successfulProductCount;
  const hasSuccesses = successfulProductCount > 0;

  return (
    <Html>
      <Head />
      <Preview>
        {`${failedProductCount} products failed during your import`}
      </Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Your import completed with errors
            </Heading>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                {hasSuccesses ? (
                  <>
                    Your import of <strong>{filename}</strong> completed, but{" "}
                    <strong className="text-red-600">
                      {failedProductCount.toLocaleString()} products
                    </strong>{" "}
                    failed to import.{" "}
                    <strong className="text-green-600">
                      {successfulProductCount.toLocaleString()} products
                    </strong>{" "}
                    were successfully imported.
                  </>
                ) : (
                  <>
                    Your import of <strong>{filename}</strong> failed.{" "}
                    <strong className="text-red-600">
                      {failedProductCount.toLocaleString()} products
                    </strong>{" "}
                    could not be imported due to validation errors.
                  </>
                )}
              </Text>
            </Section>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                Download the error report to see which products need
                corrections. The failed cells are highlighted in red so you can
                quickly identify and fix the issues.
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
                started a product import that completed with errors.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: ImportFailuresEmailProps = {
  failedProductCount: 23,
  successfulProductCount: 134,
  downloadUrl: "https://storage.example.com/corrections/download?token=abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  filename: "product-import-2026-01-11.xlsx",
};
