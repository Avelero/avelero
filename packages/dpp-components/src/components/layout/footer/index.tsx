/**
 * DPP footer with brand label and social link shortcuts.
 */
import { createFixedSelectionAttributes } from "../../../lib/editor-selection";
import { resolveStyles } from "../../../lib/resolve-styles";
import type { Passport, SocialLinks } from "../../../types/passport";

interface Props {
  footer: Passport["footer"];
  tokens: Passport["tokens"];
  brandName: string;
}

function isValidUrl(url: string): boolean {
  // Guard against empty strings and non-http(s) values before rendering links.
  if (!url || typeof url !== "string" || url.trim() === "") return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

const SOCIAL_LABELS: Array<{ key: keyof SocialLinks; text: string }> = [
  { key: "instagram", text: "IG" },
  { key: "facebook", text: "FB" },
  { key: "twitter", text: "X" },
  { key: "pinterest", text: "PT" },
  { key: "tiktok", text: "TK" },
  { key: "youtube", text: "YT" },
  { key: "linkedin", text: "LK" },
];

export function Footer({ footer, tokens, brandName }: Props) {
  // Resolve the footer styles once so the stored defaults drive the rendered chrome.
  const s = resolveStyles(footer.styles, tokens);
  const select = createFixedSelectionAttributes();
  const footerSelection = select("footer");
  const brandNameSelection = select("footer.brandName");
  const socialIconSelection = select("footer.socialIcon");

  const socialMedia = SOCIAL_LABELS.map((item) => ({
    text: item.text,
    url: footer.social[item.key],
  })).filter((item) => isValidUrl(item.url ?? ""));

  return (
    <div {...footerSelection} className="w-full" style={s.container}>
      <div
        className="flex justify-between items-center p-sm border-t"
        style={{ borderColor: s.container?.borderColor }}
      >
        <div {...brandNameSelection} style={s.brandName}>
          {brandName}
        </div>
        <div className="flex items-center gap-md">
          {socialMedia.map((item) => (
            <a
              key={item.text}
              {...socialIconSelection}
              href={item.url}
              className="cursor-pointer"
              style={s.socialIcon}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${item.text} (opens in new tab)`}
            >
              <span>{item.text}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
