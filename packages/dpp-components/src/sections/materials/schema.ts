/**
 * Materials section schema.
 *
 * Defines the editor controls for the materials breakdown cards.
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import { createModalSchemaGroup } from "../modal-schema";
import type { SectionSchema } from "../registry";

export const MATERIALS_SCHEMA: SectionSchema = {
  type: "materials",
  displayName: "Materials",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "materials",
    displayName: "Materials",
    children: [
      {
        id: "materials.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
          {
            type: "select",
            path: "title.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.backgroundColor", label: "Background" },
          {
            type: "toggle",
            path: "card.boxShadow",
            label: "Shadow",
          },
          {
            type: "toggle",
            path: "card.borderWidth",
            label: "Border",
            enabledValue: 1,
            disabledValue: 0,
          },
          {
            type: "color",
            path: "card.borderColor",
            label: "Border / Divider Color",
          },
          { type: "radius", path: "card.borderRadius", label: "Border Radius" },
        ],
      },
      {
        id: "materials.card.percentage",
        displayName: "Percentage",
        styleFields: [
          { type: "color", path: "card.percentage.color", label: "Color" },
          {
            type: "typescale",
            path: "card.percentage.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.percentage.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card.type",
        displayName: "Material Type",
        styleFields: [
          { type: "color", path: "card.type.color", label: "Color" },
          {
            type: "typescale",
            path: "card.type.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.type.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card.origin",
        displayName: "Origin",
        styleFields: [
          { type: "color", path: "card.origin.color", label: "Color" },
          {
            type: "typescale",
            path: "card.origin.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.origin.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "materials.card.locationIcon",
        displayName: "Location Icon",
        styleFields: [
          { type: "color", path: "card.locationIcon.color", label: "Color" },
          {
            type: "number",
            path: "card.locationIcon.size",
            label: "Size",
            unit: "px",
          },
        ],
      },
      {
        id: "materials.card.certification",
        displayName: "Certification Badge",
        styleFields: [
          {
            type: "color",
            path: "card.certification.color",
            label: "Text Color",
          },
          {
            type: "color",
            path: "card.certification.backgroundColor",
            label: "Background",
          },
          {
            type: "radius",
            path: "card.certification.borderRadius",
            label: "Border Radius",
          },
          {
            type: "typescale",
            path: "card.certification.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.certification.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
        configFields: [
          {
            type: "toggle",
            path: "showCertificationCheckIcon",
            label: "Show Check Icon",
          },
        ],
      },
      {
        id: "materials.card.certIcon",
        displayName: "Cert Icon",
        styleFields: [
          { type: "color", path: "card.certIcon.color", label: "Color" },
          {
            type: "number",
            path: "card.certIcon.size",
            label: "Size",
            unit: "px",
          },
        ],
      },
      {
        id: "materials.card.certText",
        displayName: "Certification Text",
        styleFields: [
          { type: "color", path: "card.certText.color", label: "Color" },
          {
            type: "typescale",
            path: "card.certText.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "card.certText.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      createModalSchemaGroup("materials"),
    ],
  },
};
