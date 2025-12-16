import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integration Settings | Avelero",
};

export default function IntegrationDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}



