import { SetupForm } from "@/components/forms/setup-form";
import { Header } from "@/components/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup | Avelero",
};

export default async function Page() {
  return (
    <div className="h-full w-full">
      <Header hideUserMenu disableLogoLink />
      <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
        <SetupForm />
      </div>
    </div>
  );
}
