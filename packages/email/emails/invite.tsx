import React from "react";
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

interface InviteEmailProps {
  recipientEmail: string;
  brandName: string;
  role: string;
  acceptUrl: string;
  expiresAt?: string; // ISO string for display
  appName?: string;
  ctaMode?: "accept" | "view";
}

export default function InviteEmail({
  recipientEmail,
  brandName,
  role,
  acceptUrl,
  expiresAt,
  appName = "Avelero",
  ctaMode = "accept",
}: InviteEmailProps) {
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleString() : undefined;
  const mode = ctaMode ?? (acceptUrl.includes("/account/brands") ? "view" : "accept");
  const ctaLabel = mode === "view" ? "View invitation" : "Accept invitation";

  return (
    <Html>
      <Head />
      <Preview>You're invited to {brandName} on {appName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Join {brandName}
            </Heading>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                You have been invited to join <strong>{brandName}</strong> as <strong>{role}</strong>.
              </Text>
            </Section>

            <Section className="mb-6 text-center">
              <a
                href={acceptUrl}
                className="inline-block rounded-md bg-black text-white px-4 py-3 text-sm font-medium"
              >
                {ctaLabel}
              </a>
            </Section>

            <Section className="mb-6 text-center">
              <Text className="text-neutral-600">
                Please continue the sign up or log in process using this email: <strong>{recipientEmail}</strong>.
              </Text>
              {expiryText ? (
                <Text className="text-neutral-500 text-sm">
                  This invitation may expire on {expiryText}.
                </Text>
              ) : null}
            </Section>

            <Hr />
            <Section className="mt-4 text-center">
              <Text className="text-xs text-neutral-500">
                If you didn’t expect this invitation, you can ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: InviteEmailProps = {
  recipientEmail: "john@example.com",
  brandName: "Acme Corp",
  role: "Editor",
  acceptUrl: "https://app.avelero.com/accept?token=abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  appName: "Avelero",
};

