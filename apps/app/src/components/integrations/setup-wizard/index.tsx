"use client";

import { StepMode } from "./step-mode";
import { StepIdentifier } from "./step-identifier";
import { StepFields } from "./step-fields";
import {
    useUpdateIntegrationMutation,
    useUpdateFieldMappingsBatchMutation,
    useFieldMappingsQuery,
} from "@/hooks/use-integrations";
import { getConnectorFields } from "@v1/integrations";
import { toast } from "@v1/ui/sonner";
import { useMemo, useState } from "react";

type WizardStep = 1 | 2 | 3;

interface SetupWizardProps {
    brandIntegrationId: string;
    connectorSlug: string;
    integrationName: string;
    existingPrimaryName: string | null;
    onCancel: () => void;
    onSetupComplete: () => void;
}

/**
 * Multi-step setup wizard for new integrations.
 *
 * Step 1: Choose Primary/Secondary mode
 * Step 2: Choose match identifier (SKU/Barcode)
 * Step 3: Configure field ownership
 *
 * On complete, saves all settings via batch API calls.
 */
export function SetupWizard({
    brandIntegrationId,
    connectorSlug,
    integrationName,
    existingPrimaryName,
    onCancel,
    onSetupComplete,
}: SetupWizardProps) {
    // Wizard state
    const [step, setStep] = useState<WizardStep>(1);
    const [isPrimary, setIsPrimary] = useState<boolean | null>(null);
    const [matchIdentifier, setMatchIdentifier] = useState<"sku" | "barcode">("barcode");

    // Mutations
    const updateIntegrationMutation = useUpdateIntegrationMutation();
    const batchFieldMutation = useUpdateFieldMappingsBatchMutation();
    const { refetch: refetchFieldMappings } = useFieldMappingsQuery(brandIntegrationId);

    // Available fields for step 3
    const availableFields = useMemo(
        () => getConnectorFields(connectorSlug),
        [connectorSlug],
    );

    const isSaving =
        updateIntegrationMutation.status === "pending" ||
        batchFieldMutation.status === "pending";

    // Step 1: Mode selection
    function handleModeNext(selectedIsPrimary: boolean) {
        setIsPrimary(selectedIsPrimary);
        setStep(2);
    }

    // Step 2: Identifier selection
    function handleIdentifierNext(identifier: "sku" | "barcode") {
        setMatchIdentifier(identifier);
        setStep(3);
    }

    // Step 3: Complete - save all settings
    async function handleComplete(enabledFields: Set<string>) {
        try {
            // 1. Save integration settings (isPrimary + matchIdentifier)
            await updateIntegrationMutation.mutateAsync({
                id: brandIntegrationId,
                is_primary: isPrimary ?? false,
                match_identifier: matchIdentifier,
            });

            // 2. Save field configurations
            await batchFieldMutation.mutateAsync({
                brand_integration_id: brandIntegrationId,
                fields: availableFields.map((field) => ({
                    field_key: field.fieldKey,
                    ownership_enabled: enabledFields.has(field.fieldKey),
                })),
            });

            // 3. Refetch to ensure the data is in cache before transitioning
            await refetchFieldMappings();

            toast.success("Integration configured successfully");
            onSetupComplete();
        } catch (error) {
            toast.error("Failed to save configuration");
        }
    }

    // Render current step
    switch (step) {
        case 1:
            return (
                <StepMode
                    existingPrimaryName={existingPrimaryName}
                    onNext={handleModeNext}
                />
            );

        case 2:
            return (
                <StepIdentifier
                    onNext={handleIdentifierNext}
                    onBack={() => setStep(1)}
                />
            );

        case 3:
            return (
                <StepFields
                    connectorSlug={connectorSlug}
                    integrationName={integrationName}
                    onComplete={handleComplete}
                    onBack={() => setStep(2)}
                    isSaving={isSaving}
                />
            );

        default:
            return null;
    }
}
