import { SetupForm } from "@/components/forms/setup-form";

export const metadata = { title: "Setup" };

export default async function Page() {
  return (
    <div className="px-4 py-12 flex justify-center">
      <SetupForm />
    </div>
  );
}


