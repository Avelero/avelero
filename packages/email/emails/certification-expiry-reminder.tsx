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

interface CertificationExpiryReminderProps {
  /** The brand's configured email address */
  brandEmail: string;
  /** The brand's display name */
  brandName: string;
  /** The title of the expiring certification */
  certificationTitle: string;
  /** The certification code (e.g., "GOTS-12345") */
  certificationCode?: string;
  /** The expiry date as ISO string */
  expiryDate: string;
  /** Number of days until expiration */
  daysUntilExpiry: number;
  /** URL to update the certification */
  updateUrl: string;
  /** Application name */
  appName?: string;
}

export default function CertificationExpiryReminder({
  brandEmail,
  brandName,
  certificationTitle,
  certificationCode,
  expiryDate,
  daysUntilExpiry,
  updateUrl,
  appName = "Avelero",
}: CertificationExpiryReminderProps) {
  const formattedExpiryDate = new Date(expiryDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyText =
    daysUntilExpiry === 1
      ? "expires tomorrow"
      : daysUntilExpiry === 7
        ? "expires in 1 week"
        : `expires in ${daysUntilExpiry} days`;

  const certDisplayName = certificationCode
    ? `${certificationTitle} (${certificationCode})`
    : certificationTitle;

  return (
    <Html>
      <Head />
      <Preview>
        Action required: Your {certificationTitle} certification {urgencyText}
      </Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-[40px] mx-auto max-w-[600px]">
            <Heading className="font-semibold text-center p-0 my-[24px] mx-0">
              Certification Expiring Soon
            </Heading>

            <Section className="mb-4">
              <Text className="text-neutral-600">
                Hi <strong>{brandName}</strong>,
              </Text>
              <Text className="text-neutral-600">
                Your certification <strong>{certDisplayName}</strong>{" "}
                {urgencyText} on <strong>{formattedExpiryDate}</strong>.
              </Text>
              <Text className="text-neutral-600">
                To maintain compliance and keep your Digital Product Passports
                up to date, please renew your certification before it expires.
              </Text>
            </Section>

            <Section className="mb-6 text-center">
              <a
                href={updateUrl}
                className="inline-block rounded-md bg-black text-white px-4 py-3 text-sm font-medium"
              >
                Update Certification
              </a>
            </Section>

            {daysUntilExpiry <= 7 && (
              <Section className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <Text className="text-amber-800 text-sm m-0">
                  <strong>⚠️ Urgent:</strong> This certification expires in{" "}
                  {daysUntilExpiry === 1 ? "1 day" : `${daysUntilExpiry} days`}.
                  Products linked to this certification may show as
                  non-compliant after expiration.
                </Text>
              </Section>
            )}

            <Hr />

            <Section className="mt-4 text-center">
              <Text className="text-xs text-neutral-500">
                This email was sent to {brandEmail} because it is configured as
                the communication email for {brandName} on {appName}.
              </Text>
              <Text className="text-xs text-neutral-500">
                If you've already renewed this certification, you can update it
                in your {appName} dashboard.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const previewProps: CertificationExpiryReminderProps = {
  brandEmail: "sustainability@acmecorp.com",
  brandName: "Acme Corp",
  certificationTitle: "Global Organic Textile Standard",
  certificationCode: "GOTS-2024-12345",
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  daysUntilExpiry: 30,
  updateUrl: "https://app.avelero.com/settings",
  appName: "Avelero",
};
