import {
  CreateBrandForm,
  CreateBrandFormSkeleton,
} from "@/components/brands/create-brand-form";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Create Brand | Avelero Admin",
};

export default function Page() {
  return (
    <Suspense fallback={<CreateBrandFormSkeleton />}>
      <CreateBrandForm />
    </Suspense>
  );
}
