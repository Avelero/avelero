import { CreatePassportForm } from "@/components/forms/create-passport-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {

  return (
    <CreatePassportForm />
  );
}
