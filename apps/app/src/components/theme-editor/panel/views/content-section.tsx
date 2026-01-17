"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { findComponentById, type ContentField } from "../../registry";
import {
  EditorSection,
  TextInput,
  UrlInput,
  ToggleInput,
  NumberInput,
  TextareaInput,
  ImageInput,
  CarouselInput,
  MenuInput,
} from "../inputs";

// =============================================================================
// MODAL FIELD COMPONENT
// =============================================================================

interface ModalFieldProps {
  field: ContentField;
}

function ModalField({ field }: ModalFieldProps) {
  // Handle different modal types
  if (field.modalType === "carousel-products") {
    return <CarouselInput field={field} />;
  }

  // Handle menu modals (primary and secondary)
  if (
    field.modalType === "menu-primary" ||
    field.modalType === "menu-secondary"
  ) {
    const menuType =
      field.modalType === "menu-primary" ? "primary" : "secondary";
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
        <TextInput
          field={field}
          value={value}
          onChange={(v) => updateConfigValue(field.path, v)}
        />
      );

    case "textarea":
      return (
        <TextareaInput
          field={field}
          value={value}
          onChange={(v) => updateConfigValue(field.path, v)}
        />
      );

    case "url":
      return (
        <UrlInput
          field={field}
          value={value}
          onChange={(v) => updateConfigValue(field.path, v)}
        />
      );

    case "image": {
      const imageUrl = typeof value === "string" ? value : "";
      return (
        <ImageInput
          field={field}
          value={imageUrl}
          onChange={(url) => updateConfigValue(field.path, url ?? "")}
          brandId={brandId}
        />
      );
    }

    case "toggle":
      return (
        <ToggleInput
          field={field}
          value={value}
          onChange={(v) => updateConfigValue(field.path, v)}
        />
      );

    case "number":
      return (
        <NumberInput
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
