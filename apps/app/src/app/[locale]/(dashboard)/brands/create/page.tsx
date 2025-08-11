import { CreateBrandForm } from "@/components/forms/create-brand-form";

export const metadata = { title: "Create brand" };

export default async function Page() {
  return (
    <div className="px-4 py-12 flex justify-center">
      <CreateBrandForm />
    </div>
  );
}