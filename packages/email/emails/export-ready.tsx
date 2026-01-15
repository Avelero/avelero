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

interface ExportReadyEmailProps {
  productCount: number;
  downloadUrl: string;
  expiresAt: string; // ISO string
}

export default function ExportReadyEmail({
  productCount,
  downloadUrl,
  expiresAt,
}: ExportReadyEmailProps) {
  const expiryDate = new Date(expiresAt);
  const expiryText = expiryDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Html>
      <Head />
      <Preview>Your product export is ready for download</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Your export is ready
            </Heading>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                Your product export containing{" "}
                <strong>{productCount.toLocaleString()} products</strong> is
                ready for download.
              </Text>
            </Section>

            <Section className="mb-6 text-center">
              <a
                href={downloadUrl}
                className="inline-block rounded-md bg-black text-white px-4 py-3 text-sm font-medium"
              >
                Download Export
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
                This email was sent by Avelero. If you did not request this
                export, please ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: ExportReadyEmailProps = {
  productCount: 156,
  downloadUrl: "https://storage.example.com/exports/download?token=abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};
