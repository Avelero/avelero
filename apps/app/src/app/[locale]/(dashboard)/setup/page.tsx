import { SetupForm } from "@/components/forms/setup-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup | Avelero",
};

export default async function Page() {
  return (
    <div className="px-4 py-12 flex justify-center">
      <SetupForm />
    </div>
  );
}


