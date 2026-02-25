import { AdminBrandDetail } from "@/components/admin/admin-brand-detail";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin brand detail | Avelero",
};

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;

  return <AdminBrandDetail brandId={brandId} />;
}
