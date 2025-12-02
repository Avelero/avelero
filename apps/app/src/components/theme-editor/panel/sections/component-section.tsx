"use client";

import { useState } from "react";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import {
  findComponentById,
  type StyleField,
  type ConfigField,
} from "../../registry/component-registry";
import { ColorInput } from "../inputs/color-input";
import { PixelInput } from "../inputs/pixel-input";
import { RadiusInput } from "../inputs/radius-input";
import { MenuItems } from "../inputs/menu-items";
import { FieldWrapper } from "../inputs/field-wrapper";
import { ImageUploader } from "@/components/image-upload";
import { Input } from "@v1/ui/input";
import { Select } from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

// =============================================================================
// EDITOR TABS (inlined)
// =============================================================================

type EditorTab = "style" | "content";

interface EditorTabsProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  showContentTab?: boolean;
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-full px-1 flex items-center",
        isActive ? "border-b-2 border-primary -mb-px" : "border-b border-transparent"
      )}
    >
      <span
        className={cn(
          "type-p",
          isActive
            ? "text-primary !font-medium"
            : "text-secondary !font-medium hover:text-primary transition-colors duration-150"
        )}
      >
        {label}
      </span>
    </button>
  );
}

function EditorTabs({ activeTab, onTabChange, showContentTab = true }: EditorTabsProps) {
  return (
    <div className="flex items-center h-[44px] gap-4 px-4 border-b border-border">
      <TabButton label="Style" isActive={activeTab === "style"} onClick={() => onTabChange("style")} />
      {showContentTab && (
        <TabButton label="Content" isActive={activeTab === "content"} onClick={() => onTabChange("content")} />
      )}
    </div>
  );
}

// =============================================================================
// EDITOR SECTION (inlined)
// =============================================================================

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border p-4">
      <span className="type-small font-medium text-primary mb-3 block">{title}</span>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Typescale options for style fields
const TYPESCALE_OPTIONS = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "body", label: "Body" },
  { value: "body-sm", label: "Small" },
  { value: "body-xs", label: "Extra Small" },
];

// =============================================================================
// STYLE FIELD RENDERER
// =============================================================================

interface StyleFieldRendererProps {
  field: StyleField;
}

function StyleFieldRenderer({ field }: StyleFieldRendererProps) {
  const { getComponentStyleValue, updateComponentStyle } = useDesignEditor();

  const value = getComponentStyleValue(field.path);

  switch (field.type) {
    case "color":
      return (
        <ColorInput
          label={field.label}
          value={typeof value === "string" ? value.replace("#", "") : ""}
          onChange={(hex) => updateComponentStyle(field.path, `#${hex}`)}
          showOpacity={true}
          opacity={100}
        />
      );

    case "number":
      return (
        <PixelInput
          label={field.label}
          value={typeof value === "number" ? value : 0}
          onChange={(num) => updateComponentStyle(field.path, num)}
          unit={field.unit}
          min={0}
        />
      );

    case "radius": {
      // Handle both single value (legacy) and object value (4 corners)
      const defaultRadius = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
      let radiusValues = defaultRadius;
      
      if (typeof value === "number") {
        // Legacy single value - apply to all corners
        radiusValues = { topLeft: value, topRight: value, bottomLeft: value, bottomRight: value };
      } else if (value && typeof value === "object" && "topLeft" in value) {
        const v = value as { topLeft: number; topRight: number; bottomLeft: number; bottomRight: number };
        radiusValues = { 
          topLeft: v.topLeft ?? 0, 
          topRight: v.topRight ?? 0, 
          bottomLeft: v.bottomLeft ?? 0, 
          bottomRight: v.bottomRight ?? 0 
        };
      }
      
      return (
        <RadiusInput
          label={field.label}
          values={radiusValues}
          onChange={(newValues) => updateComponentStyle(field.path, newValues as unknown as string)}
        />
      );
    }

    case "typescale":
      return (
        <FieldWrapper label={field.label}>
          <Select
            value={typeof value === "string" ? value : null}
            onValueChange={(val) => updateComponentStyle(field.path, val)}
            options={TYPESCALE_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );

    case "select":
      return (
        <FieldWrapper label={field.label}>
          <Select
            value={typeof value === "string" ? value : null}
            onValueChange={(val) => updateComponentStyle(field.path, val)}
            options={field.options || []}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );

    case "toggle":
      return null;

    default:
      return null;
  }
}

// =============================================================================
// CONFIG FIELD RENDERER
// =============================================================================

interface ConfigFieldRendererProps {
  field: ConfigField;
}

function ConfigFieldRenderer({ field }: ConfigFieldRendererProps) {
  const { getConfigValue, updateConfigValue, brandId } = useDesignEditor();

  const value = getConfigValue(field.path);

  const buildAssetFolder = (configPath?: string) => {
    const path = configPath?.toLowerCase() ?? "";
    if (path.includes("bannerbackgroundimage")) return "banner";
    if (path.includes("bannerlogourl")) return "banner-logo";
    if (path.includes("headerlogourl")) return "logo";
    return "asset";
  };

  switch (field.type) {
    case "text":
      return (
        <FieldWrapper label={field.label}>
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => updateConfigValue(field.path, e.target.value)}
            placeholder={field.placeholder}
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );

    case "url": {
      const urlValue = typeof value === "string" ? value : "";
      const isValidUrl = urlValue === "" || urlValue.startsWith("http://") || urlValue.startsWith("https://");
      return (
        <FieldWrapper label={field.label}>
          <div className="relative">
            <Input
              type="url"
              value={urlValue}
              onChange={(e) => updateConfigValue(field.path, e.target.value)}
              placeholder={field.placeholder || "https://"}
              className={`h-8 text-sm pr-8 ${!isValidUrl ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {urlValue && (
              <a
                href={urlValue}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary transition-colors"
                aria-label="Open link"
              >
                <Icons.SquareArrowOutUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {!isValidUrl && (
            <span className="type-small text-destructive">URL must start with http:// or https://</span>
          )}
        </FieldWrapper>
      );
    }

    case "image":
      return (
        <ImageUploader
          label={field.label}
          bucket="dpp-theme-assets"
          initialUrl={typeof value === "string" ? value : ""}
          buildPath={(file) => {
            const assetFolder = buildAssetFolder(field.path);
            return [
              brandId ?? "unknown-brand",
              "design",
              assetFolder,
              file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
            ];
          }}
          onChange={(url) => updateConfigValue(field.path, url ?? "")}
          helperText={!brandId ? "Connect to a brand to upload design assets." : undefined}
          disabled={!brandId}
          width="100%"
          height={140}
          mode="public"
        />
      );

    case "number":
      return (
        <PixelInput
          label={field.label}
          value={typeof value === "number" ? value : 0}
          onChange={(val) => updateConfigValue(field.path, val)}
        />
      );

    case "toggle":
      return (
        <FieldWrapper label={field.label} row>
          <Switch
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={(val) => updateConfigValue(field.path, val)}
          />
        </FieldWrapper>
      );

    case "select":
      return (
        <FieldWrapper label={field.label}>
          <Select
            value={typeof value === "string" ? value : null}
            onValueChange={(val) => updateConfigValue(field.path, val)}
            options={field.options || []}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );

    case "menu-items":
      return (
        <MenuItems
          label={field.label}
          value={Array.isArray(value) ? value as Array<{ label: string; url: string }> : []}
          onChange={(val) => updateConfigValue(field.path, val)}
        />
      );

    default:
      return null;
  }
}

// =============================================================================
// GROUP FIELDS BY CATEGORY
// =============================================================================

type FieldCategory = "background" | "stroke" | "typography" | "spacing" | "other";

interface GroupedFields {
  background: StyleField[];
  stroke: StyleField[];
  typography: StyleField[];
  spacing: StyleField[];
  other: StyleField[];
}

function categorizeField(field: StyleField): FieldCategory {
  const label = field.label.toLowerCase();
  const path = field.path.toLowerCase();

  if (label.includes("background") || path.includes("background")) {
    return "background";
  }

  if (
    field.type === "radius" ||
    label.includes("border") ||
    label.includes("stroke") ||
    label.includes("radius") ||
    label.includes("rounding") ||
    path.includes("border") ||
    path.includes("radius")
  ) {
    return "stroke";
  }

  if (
    field.type === "typescale" ||
    label.includes("font") ||
    label.includes("weight") ||
    label.includes("transform") ||
    label.includes("capitalization") ||
    label.includes("typescale") ||
    label.includes("color") ||
    path.includes("font") ||
    path.includes("color") ||
    path.includes("typescale") ||
    path.includes("texttransform")
  ) {
    return "typography";
  }

  if (
    label.includes("padding") ||
    label.includes("margin") ||
    label.includes("gap") ||
    label.includes("spacing") ||
    label.includes("size")
  ) {
    return "spacing";
  }

  return "other";
}

function organizeStyleFields(fields: StyleField[]): {
  mainGroups: GroupedFields;
  sectionGroups: Record<string, StyleField[]>;
  sectionOrder: string[];
} {
  const mainGroups: GroupedFields = {
    background: [],
    stroke: [],
    typography: [],
    spacing: [],
    other: [],
  };
  const sectionGroups: Record<string, StyleField[]> = {};
  const sectionOrder: string[] = [];

  for (const field of fields) {
    if (field.section) {
      const section = field.section;
      if (!sectionGroups[section]) {
        sectionGroups[section] = [];
        sectionOrder.push(section);
      }
      sectionGroups[section]?.push(field);
    } else {
      const category = categorizeField(field);
      mainGroups[category].push(field);
    }
  }

  return { mainGroups, sectionGroups, sectionOrder };
}

// =============================================================================
// COMPONENT SECTION (MAIN EXPORT)
// =============================================================================

interface ComponentSectionProps {
  componentId: string;
}

export function ComponentSection({ componentId }: ComponentSectionProps) {
  const component = findComponentById(componentId);
  const [activeTab, setActiveTab] = useState<EditorTab>("style");

  if (!component) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">Component not found</p>
      </div>
    );
  }

  const styleFields = component.styleFields || [];
  const configFields = component.configFields || [];
  const { mainGroups, sectionGroups, sectionOrder } = organizeStyleFields(styleFields);

  const hasStyleFields = styleFields.length > 0;
  const hasConfigFields = configFields.length > 0;

  if (!hasStyleFields && !hasConfigFields) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">
          No editable properties for this component
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs - only show if we have both style and content */}
      <EditorTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showContentTab={hasConfigFields}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === "style" && hasStyleFields && (
          <div className="flex flex-col">
            {/* Main field groups with section borders */}
            {mainGroups.background.length > 0 && (
              <EditorSection title="Background">
                {mainGroups.background.map((field) => (
                  <StyleFieldRenderer key={field.path} field={field} />
                ))}
              </EditorSection>
            )}

            {mainGroups.stroke.length > 0 && (
              <EditorSection title="Stroke">
                {mainGroups.stroke.map((field) => (
                  <StyleFieldRenderer key={field.path} field={field} />
                ))}
              </EditorSection>
            )}

            {mainGroups.typography.length > 0 && (
              <EditorSection title="Typography">
                {mainGroups.typography.map((field) => (
                  <StyleFieldRenderer key={field.path} field={field} />
                ))}
              </EditorSection>
            )}

            {mainGroups.spacing.length > 0 && (
              <EditorSection title="Spacing">
                {mainGroups.spacing.map((field) => (
                  <StyleFieldRenderer key={field.path} field={field} />
                ))}
              </EditorSection>
            )}

            {mainGroups.other.length > 0 && (
              <EditorSection title="Other">
                {mainGroups.other.map((field) => (
                  <StyleFieldRenderer key={field.path} field={field} />
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
                    <StyleFieldRenderer key={field.path} field={field} />
                  ))}
                </EditorSection>
              );
            })}
          </div>
        )}

        {activeTab === "content" && hasConfigFields && (
          <div className="flex flex-col">
            {configFields.map((field) => (  
              <ConfigFieldRenderer key={field.path} field={field} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

