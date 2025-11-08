import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

interface ContactConfirmationProps {
  name: string;
  email: string;
}

export default function ContactConfirmation({
  name,
  email,
}: ContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Thanks for reaching out to Avelero!</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Thanks for reaching out!
            </Heading>

            <Section className="mb-4">
              <Text className="text-neutral-600">Hi {name},</Text>
              <Text className="text-neutral-600">
                We received your message and one of our founders will reach out
                to you shortly.
              </Text>
              <Text className="text-neutral-600">
                In the meantime, feel free to explore our{" "}
                <a
                  href="https://avelero.com"
                  className="text-blue-600 underline"
                >
                  website
                </a>{" "}
                to learn more about how we're making product passports simple
                for fashion brands.
              </Text>
            </Section>

            <Section className="mt-8">
              <Text className="text-neutral-500 text-sm">
                This email was sent to {email}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: ContactConfirmationProps = {
  name: "John Doe",
  email: "john@example.com",
};
