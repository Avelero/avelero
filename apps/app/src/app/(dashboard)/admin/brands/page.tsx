import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin brands | Avelero",
};

export default function AdminBrandsPage() {
  redirect("/admin");
}
