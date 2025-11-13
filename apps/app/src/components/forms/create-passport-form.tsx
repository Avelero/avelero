"use client";

import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";
import { useRouter } from "next/navigation";

interface PassportFormProps {
  mode: "create" | "edit";
  upid?: string;
}

export function PassportForm({ mode, upid }: PassportFormProps) {
  // TODO: fetch initial passport data using upid when mode is "edit"
  const router = useRouter();
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Wire up submission logic to actually create/update passport
    // For now, just navigate back to the passports page
    router.push("/passports");
  };
  
  return (
    <form 
      id="passport-form"
      className="flex justify-center w-full"
      onSubmit={handleSubmit}
    >
      <PassportFormScaffold
        title={mode === "create" ? "Create passport" : "Edit passport"}
        left={
          <>
            <BasicInfoSection />
            <OrganizationSection />
            <EnvironmentSection />
            <MaterialsSection />
            <JourneySection />
          </>
        }
        right={
          <>
            <StatusSection />
            <IdentifiersSection />
          </>
        }
      />
    </form>
  );
}

// Convenience exports for backwards compatibility
export function CreatePassportForm() {
  return <PassportForm mode="create" />;
}

export function EditPassportForm({ upid }: { upid: string }) {
  return <PassportForm mode="edit" upid={upid} />;
}

