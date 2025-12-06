"use client";

import { useCallback, useRef, useState } from "react";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import {
    findComponentById,
    type ContentField,
} from "../../registry/component-registry";
import { Input } from "@v1/ui/input";
import { Switch } from "@v1/ui/switch";
import { Label } from "@v1/ui/label";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { ImageUploader } from "@/components/image-upload";
import { CarouselProductsModal } from "@/components/modals/carousel-products-modal";
import type { FilterState } from "@/components/tables/carousel-products";
import { createClient } from "@v1/supabase/client";
import { Link } from "lucide-react";
import { MenuInput } from "../inputs/menu-input";

// =============================================================================
// EDITOR SECTION (reused from styles-section pattern)
// =============================================================================

function EditorSection({
    title,
    children,
}: { title: string; children: React.ReactNode }) {
    return (
        <div className="border-b border-border p-4">
            <span className="type-small font-medium text-primary mb-3 block">
                {title}
            </span>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
}

// =============================================================================
// FIELD WRAPPER
// =============================================================================

function FieldWrapper({
    label,
    children,
}: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label variant="small">{label}</Label>
            {children}
        </div>
    );
}

// =============================================================================
// HELPER: Extract path from Supabase URL
// =============================================================================

/**
 * Extract the storage path from a public Supabase URL.
 * Example: https://xxx.supabase.co/storage/v1/object/public/dpp-assets/brand-123/header-logo/logo.png
 * Returns: brand-123/header-logo/logo.png
 */
function extractPathFromUrl(url: string): string | null {
    try {
        const match = url.match(/\/dpp-assets\/(.+)$/);
        return match?.[1] ?? null;
    } catch {
        return null;
    }
}

// =============================================================================
// IMAGE FIELD COMPONENT
// =============================================================================

interface ImageFieldProps {
    field: ContentField;
    value: string;
    onChange: (url: string | null) => void;
    brandId?: string;
}

function ImageField({ field, value, onChange, brandId }: ImageFieldProps) {
    // Track the previous URL for deletion when image changes
    const previousUrlRef = useRef<string | null>(value || null);

    const handleImageChange = useCallback(
        async (url: string | null, _path: string[] | null) => {
            // Delete old image if we're replacing it
            if (previousUrlRef.current && previousUrlRef.current !== url) {
                try {
                    const supabase = createClient();
                    const oldPath = extractPathFromUrl(previousUrlRef.current);
                    if (oldPath) {
                        await supabase.storage.from("dpp-assets").remove([oldPath]);
                    }
                } catch (error) {
                    console.error("Failed to delete old image:", error);
                }
            }

            previousUrlRef.current = url;
            onChange(url);
        },
        [onChange],
    );

    // Determine the folder based on the field path
    const getStorageFolder = (fieldPath: string): string => {
        if (fieldPath.includes("headerLogo") || fieldPath.includes("branding")) {
            return "header-logo";
        }
        if (fieldPath.includes("banner") || fieldPath.includes("cta")) {
            return "banner";
        }
        return "assets";
    };

    // Determine dimensions based on field path
    const getDimensions = (
        fieldPath: string,
    ): { width: number; height: number } => {
        if (fieldPath.includes("headerLogo") || fieldPath.includes("branding")) {
            return { width: 250, height: 50 };
        }
        if (fieldPath.includes("banner") || fieldPath.includes("cta")) {
            return { width: 250, height: 100 };
        }
        return { width: 250, height: 100 };
    };

    const folder = getStorageFolder(field.path);
    const dimensions = getDimensions(field.path);

    return (
        <FieldWrapper label={field.label}>
            <ImageUploader
                bucket="dpp-assets"
                mode="public"
                width={dimensions.width}
                height={dimensions.height}
                initialUrl={value || undefined}
                buildPath={(file) => {
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const timestamp = Date.now();
                    return [brandId!, folder, `${timestamp}-${safeName}`];
                }}
                uploadOnSelect={true}
                onChange={handleImageChange}
            />
        </FieldWrapper>
    );
}

// =============================================================================
// CAROUSEL PRODUCTS FIELD
// =============================================================================

interface CarouselProductsFieldProps {
    field: ContentField;
}

/**
 * Field component for carousel product selection.
 * Opens modal and saves selection to themeConfig.carousel.
 */
function CarouselProductsField({ field }: CarouselProductsFieldProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const { getConfigValue, updateConfigValue } = useDesignEditor();

    // Get current carousel config
    const carouselConfig = getConfigValue("carousel") as {
        includeIds?: string[];
        excludeIds?: string[];
        filter?: Record<string, unknown>;
    } | undefined;

    // Calculate selected count for display
    const selectedCount = carouselConfig?.includeIds?.length ?? 0;
    const hasSelection = selectedCount > 0 || (carouselConfig?.excludeIds?.length ?? 0) > 0;

    const handleSave = (selection: {
        filter: FilterState | null;
        includeIds: string[];
        excludeIds: string[];
    }) => {
        // Update carousel config with selection
        // We preserve existing carousel settings and merge in the selection
        const currentConfig = getConfigValue("carousel") as Record<string, unknown> | undefined;

        updateConfigValue("carousel", {
            ...currentConfig,
            filter: selection.filter ?? undefined,
            includeIds: selection.includeIds.length > 0 ? selection.includeIds : undefined,
            excludeIds: selection.excludeIds.length > 0 ? selection.excludeIds : undefined,
        });
    };

    return (
        <FieldWrapper label={field.label}>
            <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setModalOpen(true)}
            >
                <span className="px-1">
                    {hasSelection
                        ? selectedCount > 0
                            ? `${selectedCount} product${selectedCount !== 1 ? "s" : ""} selected`
                            : "All products (with exclusions)"
                        : "Configure"}
                </span>
                <Icons.ChevronRight className="h-4 w-4" />
            </Button>
            <CarouselProductsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                initialSelection={{
                    filter: carouselConfig?.filter as any,
                    includeIds: carouselConfig?.includeIds ?? [],
                    excludeIds: carouselConfig?.excludeIds ?? [],
                }}
                onSave={handleSave}
            />
        </FieldWrapper>
    );
}

// =============================================================================
// NUMBER FIELD COMPONENT
// =============================================================================

interface NumberFieldProps {
    field: ContentField;
    value: unknown;
    onChange: (value: number) => void;
}

function NumberField({ field, value, onChange }: NumberFieldProps) {
    const [localValue, setLocalValue] = useState<string>(() => {
        const numValue = typeof value === "number" ? value : 0;
        return String(numValue);
    });

    return (
        <FieldWrapper label={field.label}>
            <Input
                type="number"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => {
                    const parsed = Number(localValue);
                    if (!isNaN(parsed)) {
                        onChange(parsed);
                    } else {
                        // Reset to current value if invalid
                        const numValue = typeof value === "number" ? value : 0;
                        setLocalValue(String(numValue));
                    }
                }}
                min={field.min}
                max={field.max}
                className="h-8 text-sm w-24"
            />
        </FieldWrapper>
    );
}

// =============================================================================
// TEXT FIELD COMPONENT
// =============================================================================

interface TextFieldProps {
    field: ContentField;
    value: unknown;
    onChange: (value: string) => void;
}

function TextField({ field, value, onChange }: TextFieldProps) {
    return (
        <FieldWrapper label={field.label}>
            <Input
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder}
                className="h-8 text-sm"
            />
        </FieldWrapper>
    );
}

// =============================================================================
// TEXTAREA FIELD COMPONENT
// =============================================================================

interface TextareaFieldProps {
    field: ContentField;
    value: unknown;
    onChange: (value: string) => void;
}

function TextareaField({ field, value, onChange }: TextareaFieldProps) {
    return (
        <FieldWrapper label={field.label}>
            <textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder}
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
        </FieldWrapper>
    );
}

// =============================================================================
// URL FIELD COMPONENT
// =============================================================================

interface UrlFieldProps {
    field: ContentField;
    value: unknown;
    onChange: (value: string) => void;
}

function UrlField({ field, value, onChange }: UrlFieldProps) {
    return (
        <FieldWrapper label={field.label}>
            <Input
                type="url"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder || "https://..."}
                className="h-8 text-sm"
            />
        </FieldWrapper>
    );
}

// =============================================================================
// TOGGLE FIELD COMPONENT
// =============================================================================

interface ToggleFieldProps {
    field: ContentField;
    value: unknown;
    onChange: (value: boolean) => void;
}

function ToggleField({ field, value, onChange }: ToggleFieldProps) {
    const checked = typeof value === "boolean" ? value : false;
    return (
        <div className="flex items-center justify-between">
            <Label variant="small">{field.label}</Label>
            <Switch
                checked={checked}
                onCheckedChange={(newChecked) => onChange(newChecked)}
            />
        </div>
    );
}

// =============================================================================
// MODAL FIELD COMPONENT
// =============================================================================

interface ModalFieldProps {
    field: ContentField;
}

function ModalField({ field }: ModalFieldProps) {
    // Handle different modal types
    if (field.modalType === "carousel-products") {
        return <CarouselProductsField field={field} />;
    }

    // Handle menu modals (primary and secondary)
    if (field.modalType === "menu-primary" || field.modalType === "menu-secondary") {
        const menuType = field.modalType === "menu-primary" ? "primary" : "secondary";
        return <MenuInput menuType={menuType} configPath={field.path} />;
    }

    // Unknown modal type
    return null;
}

// =============================================================================
// CONTENT FIELD RENDERER
// =============================================================================

interface ContentFieldRendererProps {
    field: ContentField;
    brandId?: string;
}

function ContentFieldRenderer({ field, brandId }: ContentFieldRendererProps) {
    const { getConfigValue, updateConfigValue } = useDesignEditor();

    const value = getConfigValue(field.path);

    switch (field.type) {
        case "text":
            return (
                <TextField
                    field={field}
                    value={value}
                    onChange={(v) => updateConfigValue(field.path, v)}
                />
            );

        case "textarea":
            return (
                <TextareaField
                    field={field}
                    value={value}
                    onChange={(v) => updateConfigValue(field.path, v)}
                />
            );

        case "url":
            return (
                <UrlField
                    field={field}
                    value={value}
                    onChange={(v) => updateConfigValue(field.path, v)}
                />
            );

        case "image": {
            const imageUrl = typeof value === "string" ? value : "";
            return (
                <ImageField
                    field={field}
                    value={imageUrl}
                    onChange={(url) => updateConfigValue(field.path, url ?? "")}
                    brandId={brandId}
                />
            );
        }

        case "toggle":
            return (
                <ToggleField
                    field={field}
                    value={value}
                    onChange={(v) => updateConfigValue(field.path, v)}
                />
            );

        case "number":
            return (
                <NumberField
                    field={field}
                    value={value}
                    onChange={(v) => updateConfigValue(field.path, v)}
                />
            );

        case "modal":
            return <ModalField field={field} />;

        default:
            return null;
    }
}

// =============================================================================
// ORGANIZE FIELDS BY SECTION
// =============================================================================

function organizeContentFields(fields: ContentField[]): {
    ungrouped: ContentField[];
    sectionGroups: Record<string, ContentField[]>;
    sectionOrder: string[];
} {
    const ungrouped: ContentField[] = [];
    const sectionGroups: Record<string, ContentField[]> = {};
    const sectionOrder: string[] = [];

    for (const field of fields) {
        if (field.section) {
            if (!sectionGroups[field.section]) {
                sectionGroups[field.section] = [];
                sectionOrder.push(field.section);
            }
            sectionGroups[field.section]?.push(field);
        } else {
            ungrouped.push(field);
        }
    }

    return { ungrouped, sectionGroups, sectionOrder };
}

// =============================================================================
// CONTENT SECTION (MAIN EXPORT)
// =============================================================================

interface ContentSectionProps {
    componentId: string;
}

export function ContentSection({ componentId }: ContentSectionProps) {
    const { brandId } = useDesignEditor();
    const component = findComponentById(componentId);

    if (!component) {
        return (
            <div className="p-4 text-center">
                <p className="type-small text-secondary">Component not found</p>
            </div>
        );
    }

    const configFields = component.configFields || [];

    if (configFields.length === 0) {
        return (
            <div className="p-4 text-center">
                <p className="type-small text-secondary">
                    No content properties for this component
                </p>
            </div>
        );
    }

    const { ungrouped, sectionGroups, sectionOrder } =
        organizeContentFields(configFields);

    return (
        <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
            {/* Ungrouped fields */}
            {ungrouped.length > 0 && (
                <EditorSection title="Content">
                    {ungrouped.map((field) => (
                        <ContentFieldRenderer
                            key={field.path}
                            field={field}
                            brandId={brandId}
                        />
                    ))}
                </EditorSection>
            )}

            {/* Named section groups */}
            {sectionOrder.map((sectionName) => {
                const fields = sectionGroups[sectionName];
                if (!fields) return null;
                return (
                    <EditorSection key={sectionName} title={sectionName}>
                        {fields.map((field) => (
                            <ContentFieldRenderer
                                key={field.path}
                                field={field}
                                brandId={brandId}
                            />
                        ))}
                    </EditorSection>
                );
            })}
        </div>
    );
}
