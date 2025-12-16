import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations | Avelero",
};

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}




