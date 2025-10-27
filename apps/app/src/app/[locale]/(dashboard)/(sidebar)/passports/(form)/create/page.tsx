import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";

export default function CreatePassportsPage() {
  return (
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
  );
}
