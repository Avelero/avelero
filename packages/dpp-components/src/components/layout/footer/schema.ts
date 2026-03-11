/**
 * Footer fixed component schema.
 *
 * Defines the editor tree and defaults for the footer (brand name + social links).
 */
import { CAPITALIZATION_STYLE_OPTIONS } from "../../../sections/editor-options";
import type { FixedComponentSchema } from "../../../types/editor";

export const FOOTER_SCHEMA: FixedComponentSchema = {
  id: "footer",
  displayName: "Footer",
  editorTree: {
    id: "footer",
    displayName: "Footer",
    configFields: [
      {
        type: "url",
        path: "social.instagram",
        label: "Instagram",
        placeholder: "https://instagram.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.facebook",
        label: "Facebook",
        placeholder: "https://facebook.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.pinterest",
        label: "Pinterest",
        placeholder: "https://pinterest.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.twitter",
        label: "X (Twitter)",
        placeholder: "https://x.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.tiktok",
        label: "TikTok",
        placeholder: "https://tiktok.com/@...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.youtube",
        label: "YouTube",
        placeholder: "https://youtube.com/@...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.linkedin",
        label: "LinkedIn",
        placeholder: "https://linkedin.com/company/...",
        section: "Social Links",
      },
    ],
    children: [
      {
        id: "footer.brandName",
        displayName: "Brand",
        styleFields: [
          { type: "color", path: "brandName.color", label: "Color" },
          {
            type: "typescale",
            path: "brandName.typescale",
            label: "Typography",
          },
          {
            type: "select",
            path: "brandName.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
      {
        id: "footer.socialIcon",
        displayName: "Socials",
        styleFields: [
          { type: "color", path: "socialIcon.color", label: "Color" },
        ],
      },
    ],
  },
  defaults: {
    styles: {
      container: { backgroundColor: "$background", borderColor: "$border" },
      brandName: {
        typescale: "body-sm",
        color: "$mutedForeground",
        textTransform: "none",
      },
      socialIcon: {
        typescale: "body-sm",
        color: "$link",
        textTransform: "none",
      },
    },
    content: {
      social: {
        instagram: "",
        facebook: "",
        twitter: "",
        pinterest: "",
        tiktok: "",
        youtube: "",
        linkedin: "",
      },
    },
  },
};
