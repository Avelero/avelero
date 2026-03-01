import { BrandDetail } from "@/components/brands/brand-detail";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand Detail | Avelero Admin",
};

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <BrandDetail brandId={brandId} />;
}
