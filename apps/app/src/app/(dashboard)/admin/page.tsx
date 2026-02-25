import { AdminBrandsList } from "@/components/admin/admin-brands-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin brands | Avelero",
};

export default function AdminPage() {
  return <AdminBrandsList />;
}
