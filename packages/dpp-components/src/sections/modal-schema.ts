/**
 * Shared schema fragments for section-specific modal styling.
 */

import { CAPITALIZATION_STYLE_OPTIONS } from "./editor-options";
import type { ComponentDefinition, StyleField } from "./registry";

function createModalTypographyFields(path: string): StyleField[] {
  // Define the standard text controls shared by all modal typography slots.
  return [
    { type: "color", path: `${path}.color`, label: "Color" },
    { type: "typescale", path: `${path}.typescale`, label: "Typography" },
    {
      type: "select",
      path: `${path}.textTransform`,
      label: "Capitalization",
      options: [...CAPITALIZATION_STYLE_OPTIONS],
    },
  ];
}

export function createModalSchemaGroup(sectionId: string): ComponentDefinition {
  // Build the reusable editor subtree for stylable modal container and text slots.
  return {
    id: `${sectionId}.modal`,
    displayName: "Modal",
    children: [
      {
        id: `${sectionId}.modal.container`,
        displayName: "Container",
        styleFields: [
          {
            type: "color",
            path: "modal.container.backgroundColor",
            label: "Background",
          },
          {
            type: "toggle",
            path: "modal.container.boxShadow",
            label: "Shadow",
          },
          {
            type: "toggle",
            path: "modal.container.borderWidth",
            label: "Border",
            enabledValue: 1,
            disabledValue: 0,
          },
          {
            type: "color",
            path: "modal.container.borderColor",
            label: "Border Color",
          },
          {
            type: "radius",
            path: "modal.container.borderRadius",
            label: "Border Radius",
          },
        ],
      },
      {
        id: `${sectionId}.modal.title`,
        displayName: "Title",
        styleFields: createModalTypographyFields("modal.title"),
      },
      {
        id: `${sectionId}.modal.subtitle`,
        displayName: "Subtitle",
        styleFields: createModalTypographyFields("modal.subtitle"),
      },
      {
        id: `${sectionId}.modal.description`,
        displayName: "Description",
        styleFields: createModalTypographyFields("modal.description"),
      },
      {
        id: `${sectionId}.modal.label`,
        displayName: "Label",
        styleFields: createModalTypographyFields("modal.label"),
      },
      {
        id: `${sectionId}.modal.value`,
        displayName: "Value",
        styleFields: createModalTypographyFields("modal.value"),
      },
    ],
  };
}
