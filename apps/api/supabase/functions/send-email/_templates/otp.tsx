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

interface OtpEmailProps {
  code: string;
  siteUrl?: string;
  appName?: string;
}

export default function OtpEmail({
  code,
  siteUrl = "",
  appName = "Avelero",
}: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your verification code for {appName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Verify your email
            </Heading>

            <Section className="mb-4 text-center">
              <Text className="text-neutral-600">
                Use the 6-digit code below to continue. This code expires soon.
              </Text>
            </Section>

            <Section className="mb-6 text-center">
              <div className="inline-block rounded-md border border-neutral-200 px-4 py-3">
                <code className="text-2xl tracking-[6px] font-mono">
                  {code}
                </code>
              </div>
            </Section>

            {siteUrl ? (
              <Section className="mb-8 text-center">
                <Text className="text-neutral-600">
                  You can safely return to {siteUrl} and enter this code there.
                </Text>
              </Section>
            ) : null}

            <Hr />
            <Section className="mt-4 text-center">
              <Text className="text-xs text-neutral-500">
                If you didn’t request this, you can ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
