import { BrandsDashboard } from "@/components/brands/brands-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brands | Avelero Admin",
};

export default function Page() {
  return <BrandsDashboard />;
}
