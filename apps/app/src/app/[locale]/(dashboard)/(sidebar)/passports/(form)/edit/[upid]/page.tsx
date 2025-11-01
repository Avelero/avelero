"use client";

import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";

export default function EditPassportPage({
  params,
}: { params: { upid: string } }) {
  // TODO: fetch initial passport data using params.upid when implementing backend
  return (
    <form id="passport-form" className="w-full">
      <PassportFormScaffold
        title="Edit passport"
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
