import { CreateBrandForm } from "@/components/forms/create-brand-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a brand | Avelero",
};

export default async function Page() {
  return (
    <div className="px-4 py-12 flex justify-center">
      <CreateBrandForm />
    </div>
  );
}