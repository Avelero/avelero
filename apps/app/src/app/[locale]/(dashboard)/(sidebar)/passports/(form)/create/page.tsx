"use client";

import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";

export default function CreatePassportsPage() {
  return (
    <form 
      id="passport-form"
      className="flex justify-center w-full"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: Wire up submission logic
      }}
    >
      <PassportFormScaffold
        title="Create passport"
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
