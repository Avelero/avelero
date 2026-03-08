/**
 * Component Registry - Fixed Component Tree
 *
 * Contains only the fixed structural components (Header, Footer) that are
 * always rendered and not part of the layout zone system.
 *
 * Style paths are relative to passport.header.styles / passport.footer.styles.
 * Content paths are relative to passport.header / passport.footer.
 */

import { CAPITALIZATION_OPTIONS } from "./constants";
import type { ComponentDefinition } from "./types";

export const COMPONENT_TREE: ComponentDefinition[] = [
  // -------------------------------------------------------------------------
  // HEADER
  // -------------------------------------------------------------------------
  {
    id: "header",
    displayName: "Header",
    styleFields: [
      {
        type: "color",
        path: "container.backgroundColor",
        label: "Background",
      },
    ],
    configFields: [
      {
        type: "image",
        path: "logoUrl",
        label: "Logo",
      },
    ],
    children: [
      {
        id: "header.textLogo",
        displayName: "Text Logo",
        styleFields: [
          {
            type: "color",
            path: "textLogo.color",
            label: "Color",
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FOOTER
  // -------------------------------------------------------------------------
  {
    id: "footer",
    displayName: "Footer",
    styleFields: [
      {
        type: "color",
        path: "container.backgroundColor",
        label: "Background",
      },
    ],
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
          {
            type: "color",
            path: "brandName.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "brandName.typescale",
            label: "Typescale",
          },
          {
            type: "select",
            path: "brandName.textTransform",
            label: "Capitalization",
            options: CAPITALIZATION_OPTIONS,
          },
        ],
      },
      {
        id: "footer.socialIcon",
        displayName: "Socials",
        styleFields: [
          {
            type: "color",
            path: "socialIcon.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "socialIcon.typescale",
            label: "Typescale",
          },
        ],
      },
    ],
  },
];
