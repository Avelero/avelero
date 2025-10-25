import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";

/**
 * Renders the "Edit passport" page composed around a PassportFormScaffold with the form sections and sidebar used to edit an existing passport.
 *
 * @param params - Route parameters
 * @param params.upid - The unique passport identifier used to determine which passport to edit
 * @returns A React element containing the passport edit scaffold with main form sections (basic info, organization, environment, materials, journey) on the left and sidebar sections (status, identifiers) on the right
 */
export default function EditPassportPage({ params }: { params: { upid: string } }) {
  // TODO: fetch initial passport data using params.upid when implementing backend
  return (
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
  );
}


