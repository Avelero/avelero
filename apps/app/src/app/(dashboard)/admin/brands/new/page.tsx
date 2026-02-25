import { AdminBrandCreateForm } from "@/components/admin/admin-brand-create-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create admin brand | Avelero",
};

export default function AdminNewBrandPage() {
  return <AdminBrandCreateForm />;
}
