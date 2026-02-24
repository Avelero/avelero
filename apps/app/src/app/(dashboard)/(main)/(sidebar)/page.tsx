import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

export default async function DashboardPage() {
  redirect("/passports");
}
