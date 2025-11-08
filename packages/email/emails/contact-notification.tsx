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

interface ContactNotificationProps {
  name: string;
  email: string;
  company: string;
  submittedAt: string;
}

export default function ContactNotification({
  name,
  email,
  company,
  submittedAt,
}: ContactNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>New contact form submission from {name}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              New Contact Form Submission
            </Heading>

            <Section className="mb-6">
              <Text className="text-neutral-900 font-medium mb-2">
                <strong>Name:</strong> {name}
              </Text>
              <Text className="text-neutral-900 font-medium mb-2">
                <strong>Email:</strong> {email}
              </Text>
              <Text className="text-neutral-900 font-medium mb-2">
                <strong>Company:</strong> {company}
              </Text>
              <Text className="text-neutral-500 text-sm">
                Submitted: {submittedAt}
              </Text>
            </Section>

            <Hr />

            <Section className="mt-4">
              <Text className="text-neutral-600">
                <a href={`mailto:${email}`} className="text-blue-600 underline">
                  Reply to {name}
                </a>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: ContactNotificationProps = {
  name: "John Doe",
  email: "john@example.com",
  company: "Acme Corp",
  submittedAt: new Date().toLocaleString(),
};
