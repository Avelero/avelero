import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";

/**
 * Render the Create passport page composed of main form sections on the left and status/identifier blocks on the right.
 *
 * @returns A JSX element rendering a PassportFormScaffold titled "Create passport" with BasicInfo, Organization, Environment, Materials, and Journey sections in the left column and Status and Identifiers sections in the right column.
 */
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