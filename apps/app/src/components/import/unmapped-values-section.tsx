"use client";

import { MaterialSheet } from "@/components/sheets/material-sheet";
import { OperatorSheet } from "@/components/sheets/operator-sheet";
import { ShowcaseBrandSheet } from "@/components/sheets/showcase-brand-sheet";
import { SizeModal } from "@/components/modals/size-modal";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { toast } from "sonner";

//===================================================================================
// TYPES
//===================================================================================

type EntityType =
  | "MATERIAL"
  | "COLOR"
  | "SIZE"
  | "ECO_CLAIM"
  | "FACILITY"
  | "SHOWCASE_BRAND"
  | "CERTIFICATION";

interface UnmappedValue {
  rawValue: string;
  sourceColumn: string;
  affectedRows: number;
  isDefined: boolean;
}

interface UnmappedValueGroup {
  entityType: EntityType;
  values: UnmappedValue[];
}

interface UnmappedValuesResponse {
  unmappedValues: UnmappedValueGroup[];
  totalUnmapped: number;
  totalDefined: number;
}

interface UnmappedValuesSectionProps {
  jobId: string;
  onAllValuesDefined?: (allDefined: boolean) => void;
}

//===================================================================================
// HELPER FUNCTIONS
//===================================================================================

/**
 * Get human-readable entity type name
 */
function getEntityTypeName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    MATERIAL: "Materials",
    COLOR: "Colors",
    SIZE: "Sizes",
    ECO_CLAIM: "Eco Claims",
    FACILITY: "Facilities",
    SHOWCASE_BRAND: "Showcase Brands",
    CERTIFICATION: "Certifications",
  };
  return names[entityType];
}

/**
 * Get entity type icon
 */
function getEntityIcon(entityType: EntityType) {
  const icons: Record<EntityType, React.ReactNode> = {
    MATERIAL: <Icons.Shirt className="h-4 w-4" />,
    COLOR: <Icons.Palette className="h-4 w-4" />,
    SIZE: <Icons.Ruler className="h-4 w-4" />,
    ECO_CLAIM: <Icons.Leaf className="h-4 w-4" />,
    FACILITY: <Icons.Building className="h-4 w-4" />,
    SHOWCASE_BRAND: <Icons.Store className="h-4 w-4" />,
    CERTIFICATION: <Icons.Award className="h-4 w-4" />,
  };
  return icons[entityType];
}

/**
 * Check if entity type should auto-create (simple entities)
 */
function isAutoCreatedEntity(entityType: EntityType): boolean {
  return entityType === "COLOR" || entityType === "ECO_CLAIM";
}

//===================================================================================
// COMPONENT
//===================================================================================

export function UnmappedValuesSection({
  jobId,
  onAllValuesDefined,
}: UnmappedValuesSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Sheet/modal visibility state
  const [materialSheetOpen, setMaterialSheetOpen] = React.useState(false);
  const [showcaseBrandSheetOpen, setShowcaseBrandSheetOpen] =
    React.useState(false);
  const [operatorSheetOpen, setOperatorSheetOpen] = React.useState(false);
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);

  // Selected value for definition
  const [selectedValue, setSelectedValue] = React.useState<{
    entityType: EntityType;
    rawValue: string;
    sourceColumn: string;
  } | null>(null);

  // Fetch unmapped values
  const { data: response, isLoading, error } = useQuery(
    trpc.bulk.getUnmappedValues.queryOptions({ jobId })
  );

  const unmappedData = response as UnmappedValuesResponse | undefined;
  const unmappedGroups = unmappedData?.unmappedValues ?? [];
  const totalUnmapped = unmappedData?.totalUnmapped ?? 0;

  // Define value mutation
  const defineValueMutation = useMutation(
    trpc.bulk.defineValue.mutationOptions()
  );

  // Notify parent when all values are defined
  React.useEffect(() => {
    if (onAllValuesDefined) {
      onAllValuesDefined(totalUnmapped === 0);
    }
  }, [totalUnmapped, onAllValuesDefined]);

  /**
   * Handle opening the appropriate sheet for a value
   */
  const handleDefineValue = (
    entityType: EntityType,
    rawValue: string,
    sourceColumn: string
  ) => {
    setSelectedValue({ entityType, rawValue, sourceColumn });

    switch (entityType) {
      case "MATERIAL":
        setMaterialSheetOpen(true);
        break;
      case "SHOWCASE_BRAND":
        setShowcaseBrandSheetOpen(true);
        break;
      case "FACILITY":
        setOperatorSheetOpen(true);
        break;
      case "SIZE":
        setSizeModalOpen(true);
        break;
      default:
        toast.error(`Cannot define ${entityType} values manually`);
    }
  };

  /**
   * Handle entity creation from sheets/modals
   */
  const handleEntityCreated = async (entityData: {
    id: string;
    name: string;
    [key: string]: unknown;
  }) => {
    if (!selectedValue) return;

    try {
      await defineValueMutation.mutateAsync({
        jobId,
        entityType: selectedValue.entityType,
        rawValue: selectedValue.rawValue,
        sourceColumn: selectedValue.sourceColumn,
        entityData,
      });

      // Refetch unmapped values
      await queryClient.invalidateQueries({
        queryKey: trpc.bulk.getUnmappedValues.queryKey({ jobId }),
      });

      toast.success(`Defined: ${selectedValue.rawValue}`);
    } catch (err) {
      toast.error("Failed to define value. Please try again.");
      console.error("Define value error:", err);
    } finally {
      // Reset selection
      setSelectedValue(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-6 w-6 animate-spin text-brand" />
        <span className="ml-2 text-secondary">Loading unmapped values...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-2">
          <Icons.AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">
            Failed to load unmapped values. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // All values defined - success state
  if (totalUnmapped === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center">
        <Icons.CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <h3 className="mt-3 text-base font-medium">All values defined</h3>
        <p className="mt-1 text-sm text-secondary">
          All catalog values have been defined. You can now approve the import.
        </p>
      </div>
    );
  }

  // Separate auto-created entities from those needing user input
  const autoCreatedGroups = unmappedGroups.filter((g) =>
    isAutoCreatedEntity(g.entityType)
  );
  const userDefinedGroups = unmappedGroups.filter(
    (g) => !isAutoCreatedEntity(g.entityType)
  );

  const autoCreatedCount = autoCreatedGroups.reduce(
    (sum, group) => sum + group.values.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Auto-created entities info (if any) */}
      {autoCreatedCount > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-green-100 p-2">
              <Icons.CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-green-900">
                {autoCreatedCount} simple {autoCreatedCount === 1 ? "value" : "values"} auto-created
              </div>
              <div className="mt-1 text-xs text-green-700">
                {autoCreatedGroups.map((group) => (
                  <div key={group.entityType}>
                    {getEntityTypeName(group.entityType)}:{" "}
                    {group.values.map((v) => v.rawValue).join(", ")}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-green-600">
                These were automatically added to your brand catalog.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User-defined entities (need approval) */}
      {userDefinedGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium">
                Values needing definition
              </h3>
              <p className="text-sm text-secondary">
                Define these catalog entries before importing
              </p>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
              {totalUnmapped} remaining
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-3">
            {userDefinedGroups.map((group) => (
              <div
                key={group.entityType}
                className="rounded-lg border border-border bg-background"
              >
                {/* Group header */}
                <div className="flex items-center gap-3 border-b border-border bg-accent/50 p-4">
                  <div className="rounded-md bg-background p-2">
                    {getEntityIcon(group.entityType)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {getEntityTypeName(group.entityType)} ({group.values.length})
                    </div>
                    <div className="text-xs text-secondary">
                      {group.values.reduce((sum, v) => sum + v.affectedRows, 0)} rows affected
                    </div>
                  </div>
                </div>

                {/* Values list */}
                <div className="divide-y divide-border">
                  {group.values.map((value, idx) => (
                    <div
                      key={`${value.rawValue}-${idx}`}
                      className="flex items-center justify-between p-4 hover:bg-accent/30"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {value.rawValue}
                        </div>
                        <div className="text-xs text-secondary">
                          {value.affectedRows} {value.affectedRows === 1 ? "row" : "rows"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleDefineValue(
                            group.entityType,
                            value.rawValue,
                            value.sourceColumn
                          )
                        }
                        icon={<Icons.Plus className="h-4 w-4" />}
                        disabled={defineValueMutation.isPending}
                      >
                        Define
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity sheets/modals */}
      <MaterialSheet
        open={materialSheetOpen}
        onOpenChange={setMaterialSheetOpen}
        initialName={selectedValue?.rawValue ?? ""}
        onMaterialCreated={handleEntityCreated}
      />

      <ShowcaseBrandSheet
        open={showcaseBrandSheetOpen}
        onOpenChange={setShowcaseBrandSheetOpen}
        initialName={selectedValue?.rawValue ?? ""}
        onBrandCreated={handleEntityCreated}
      />

      <OperatorSheet
        open={operatorSheetOpen}
        onOpenChange={setOperatorSheetOpen}
        initialName={selectedValue?.rawValue ?? ""}
        onOperatorCreated={handleEntityCreated}
      />

      <SizeModal
        open={sizeModalOpen}
        onOpenChange={setSizeModalOpen}
        initialName={selectedValue?.rawValue ?? ""}
        onSizeCreated={handleEntityCreated}
      />
    </div>
  );
}
