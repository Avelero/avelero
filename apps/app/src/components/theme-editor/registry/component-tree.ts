/**
 * Component Registry - Fixed Component Tree
 *
 * Contains only the fixed structural components (Header, Footer) that are
 * always rendered and not part of the layout zone system.
 *
 * All zone-based components (image, hero, details, buttons, impact, materials,
 * journey, banner) are now defined in COMPONENT_LIBRARY
 * (packages/dpp-components/src/lib/component-library.ts).
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
        path: "header.borderColor",
        label: "Border Color",
      },
      {
        type: "color",
        path: "header.backgroundColor",
        label: "Background",
      },
    ],
    configFields: [
      {
        type: "image",
        path: "branding.headerLogoUrl",
        label: "Logo",
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
        path: "footer.borderColor",
        label: "Border Color",
      },
      {
        type: "color",
        path: "footer.backgroundColor",
        label: "Background",
      },
    ],
    configFields: [
      {
        type: "url",
        path: "social.instagramUrl",
        label: "Instagram",
        placeholder: "https://instagram.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.facebookUrl",
        label: "Facebook",
        placeholder: "https://facebook.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.pinterestUrl",
        label: "Pinterest",
        placeholder: "https://pinterest.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.twitterUrl",
        label: "X (Twitter)",
        placeholder: "https://x.com/...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.tiktokUrl",
        label: "TikTok",
        placeholder: "https://tiktok.com/@...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.youtubeUrl",
        label: "YouTube",
        placeholder: "https://youtube.com/@...",
        section: "Social Links",
      },
      {
        type: "url",
        path: "social.linkedinUrl",
        label: "LinkedIn",
        placeholder: "https://linkedin.com/company/...",
        section: "Social Links",
      },
    ],
    children: [
      {
        id: "footer__legal-name",
        displayName: "Brand",
        styleFields: [
          {
            type: "color",
            path: "footer__legal-name.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "footer__legal-name.typescale",
            label: "Typescale",
          },
          {
            type: "select",
            path: "footer__legal-name.textTransform",
            label: "Capitalization",
            options: CAPITALIZATION_OPTIONS,
          },
        ],
      },
      {
        id: "footer__social-icons",
        displayName: "Socials",
        styleFields: [
          {
            type: "color",
            path: "footer__social-icons.color",
            label: "Color",
          },
          {
            type: "typescale",
            path: "footer__social-icons.typescale",
            label: "Typescale",
          },
        ],
      },
    ],
  },
];
