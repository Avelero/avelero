import { CreateBrandForm } from "@/components/forms/create-brand-form";
import { Header } from "@/components/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a brand | Avelero",
};

export default async function Page() {
  return (
    <div className="h-full w-full">
      <Header locale="en" hideUserMenu disableLogoLink />
      <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
        <CreateBrandForm />
      </div>
    </div>
  );
}
