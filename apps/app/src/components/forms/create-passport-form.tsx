"use client";

import { BasicInfoSection } from "@/components/passports/form/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/passports/form/blocks/environment-block";
import { JourneySection } from "@/components/passports/form/blocks/journey-block";
import { MaterialsSection } from "@/components/passports/form/blocks/materials-block";
import { OrganizationSection } from "@/components/passports/form/blocks/organization-block";
import { VariantSection } from "@/components/passports/form/blocks/variant-block";
import { PassportFormScaffold } from "@/components/passports/form/scaffold/passport-form-scaffold";
import { IdentifiersSection } from "@/components/passports/form/sidebar/identifiers-block";
import { StatusSection } from "@/components/passports/form/sidebar/status-block";
import type { TierTwoSizeOption } from "@/components/select/size-select";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { usePassportFormData } from "@/hooks/use-passport-form-data";
import { usePassportSubmission } from "@/hooks/use-passport-submission";
import { useUserQuery } from "@/hooks/use-user";
import { useRouter } from "next/navigation";
import * as React from "react";

interface PassportFormProps {
  mode: "create" | "edit";
  upid?: string;
}

export function PassportForm({ mode, upid }: PassportFormProps) {
  const router = useRouter();
  const { data: user } = useUserQuery();
  const { isLoading } = usePassportFormData();
  const { submit, isSubmitting } = usePassportSubmission();
  const { setIsSubmitting: setContextIsSubmitting } = usePassportFormContext();

  // Basic info
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);

  // Organization
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [season, setSeason] = React.useState<string | null>(null);
  const [tagIds, setTagIds] = React.useState<string[]>([]);

  // Identifiers
  const [articleNumber, setArticleNumber] = React.useState("");
  const [ean, setEan] = React.useState("");
  const [showcaseBrandId, setShowcaseBrandId] = React.useState<string | null>(null);

  // Variant
  const [colorIds, setColorIds] = React.useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = React.useState<TierTwoSizeOption[]>([]);

  // Materials
  const [materialData, setMaterialData] = React.useState<Array<{ materialId: string; percentage: number }>>([]);

  // Journey
  const [journeySteps, setJourneySteps] = React.useState<Array<{ stepType: string; facilityId: string; sortIndex: number }>>([]);

  // Environment
  const [carbonKgCo2e, setCarbonKgCo2e] = React.useState("");
  const [waterLiters, setWaterLiters] = React.useState("");

  // Status
  const [status, setStatus] = React.useState<string>("unpublished");

  // Sync submission state to context so PassportFormActions can access it
  React.useEffect(() => {
    setContextIsSubmitting(isSubmitting);
  }, [isSubmitting, setContextIsSubmitting]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user?.brand_id) {
      return;
    }

    try {
      await submit({
        brandId: user.brand_id,
        title,
        description,
        imageFile,
        categoryId,
        season,
        showcaseBrandId,
        articleNumber,
        ean,
        status,
        colorIds,
        sizeIds: selectedSizes.map(s => s.id).filter((id): id is string => !!id),
        materials: materialData,
        journeySteps,
        carbonKgCo2e,
        waterLiters,
        tagIds,
      });
    } catch (err) {
      // Error is already handled by the submission hook
      console.error("Form submission failed:", err);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

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
            <BasicInfoSection
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              imageFile={imageFile}
              setImageFile={setImageFile}
            />
            <OrganizationSection
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              season={season}
              setSeason={setSeason}
              tagIds={tagIds}
              setTagIds={setTagIds}
            />
            <VariantSection
              colorIds={colorIds}
              setColorIds={setColorIds}
              selectedSizes={selectedSizes}
              setSelectedSizes={setSelectedSizes}
            />
            <EnvironmentSection
              carbonKgCo2e={carbonKgCo2e}
              setCarbonKgCo2e={setCarbonKgCo2e}
              waterLiters={waterLiters}
              setWaterLiters={setWaterLiters}
            />
            <MaterialsSection
              materials={materialData}
              setMaterials={setMaterialData}
            />
            <JourneySection
              journeySteps={journeySteps}
              setJourneySteps={setJourneySteps}
            />
          </>
        }
        right={
          <>
            <StatusSection
              status={status}
              setStatus={setStatus}
            />
            <IdentifiersSection
              articleNumber={articleNumber}
              setArticleNumber={setArticleNumber}
              ean={ean}
              setEan={setEan}
              showcaseBrandId={showcaseBrandId}
              setShowcaseBrandId={setShowcaseBrandId}
            />
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

