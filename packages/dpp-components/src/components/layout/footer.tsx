import type { ThemeConfig } from "@v1/dpp-components";

interface Props {
  themeConfig: ThemeConfig;
  /** Brand name to display in footer - comes from product data (manufacturer) */
  brandName: string;
}

export function Footer({ themeConfig, brandName }: Props) {
  const { social } = themeConfig;

  // Helper function to validate URLs
  const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== "string" || url.trim() === "") return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Build social media array - show if URL is valid (no separate toggle needed)
  const socialMedia = [
    { text: "IG", url: social?.instagramUrl },
    { text: "FB", url: social?.facebookUrl },
    { text: "X", url: social?.twitterUrl },
    { text: "PT", url: social?.pinterestUrl },
    { text: "TK", url: social?.tiktokUrl },
    { text: "LK", url: social?.linkedinUrl },
  ].filter((item) => isValidUrl(item.url ?? ""));

  return (
    <div className="w-full">
      <div className="footer flex justify-between items-center p-sm border-t">
        {/* Brand name on the left - comes from product data (manufacturer) */}
        <div className="footer__legal-name">{brandName}</div>

        {/* Social media on the right */}
        <div className="flex items-center gap-md">
          {socialMedia.map((item) => (
            <a
              key={item.text}
              href={item.url}
              className="footer__social-icons cursor-pointer"
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
