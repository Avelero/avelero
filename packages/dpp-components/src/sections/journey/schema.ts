import type { SectionSchema } from "../registry";

export const JOURNEY_SCHEMA: SectionSchema = {
  type: "journey",
  displayName: "Journey",
  allowedZones: ["sidebar"],
  defaultContent: {},
  defaultStyles: {
    title: { typescale: "h6", color: "$foreground" },
    card: { borderColor: "$border" },
    "card.type": { typescale: "body-sm", color: "$foreground" },
    "card.operator": { typescale: "body-xs", color: "$mutedForeground" },
    "card.line": { backgroundColor: "$border" },
  },
  editorTree: {
    id: "journey",
    displayName: "Journey",
    children: [
      {
        id: "journey.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "title.color", label: "Color" },
          { type: "typescale", path: "title.typescale", label: "Typography" },
        ],
      },
      {
        id: "journey.card",
        displayName: "Card",
        styleFields: [
          { type: "color", path: "card.borderColor", label: "Border Color" },
        ],
      },
      {
        id: "journey.card.type",
        displayName: "Stage Name",
        styleFields: [
          { type: "color", path: "card.type.color", label: "Color" },
          {
            type: "typescale",
            path: "card.type.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "journey.card.operator",
        displayName: "Operator",
        styleFields: [
          { type: "color", path: "card.operator.color", label: "Color" },
          {
            type: "typescale",
            path: "card.operator.typescale",
            label: "Typography",
          },
        ],
      },
      {
        id: "journey.card.line",
        displayName: "Timeline Line",
        styleFields: [
          { type: "color", path: "card.line.backgroundColor", label: "Color" },
        ],
      },
    ],
  },
};
