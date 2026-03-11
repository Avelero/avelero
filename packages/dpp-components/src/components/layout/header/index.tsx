/**
 * DPP header with optional brand logo image.
 */
import Image from "next/image";
import { createFixedSelectionAttributes } from "../../../lib/editor-selection";
import { resolveStyles } from "../../../lib/resolve-styles";
import type { Passport } from "../../../types/passport";

interface Props {
  header: Passport["header"];
  tokens: Passport["tokens"];
  brandName: string;
  position?: "fixed" | "sticky";
}

export function Header({
  header,
  tokens,
  brandName,
  position = "fixed",
}: Props) {
  // Resolve the fixed header styles once and expose only the header shell for editor selection.
  const s = resolveStyles(header.styles, tokens);
  const logoUrl = header.logoUrl;
  const logoHeight = 24;
  const select = createFixedSelectionAttributes();
  const headerSelection = select("header");

  const isLocalDev =
    logoUrl?.includes("127.0.0.1") || logoUrl?.includes("localhost:");

  const positionClass =
    position === "fixed"
      ? "dpp-scroll-lock-zero-right fixed top-0 left-0 right-0 z-50"
      : "sticky top-0 w-full z-50";

  const positionStyle =
    position === "sticky"
      ? { backgroundColor: "var(--background)" }
      : undefined;

  return (
    <div
      {...headerSelection}
      className={positionClass}
      style={{ ...s.container, ...positionStyle }}
    >
      <div
        className="flex items-center justify-center w-full border-b"
        style={{ padding: "20px 0", borderColor: s.container?.borderColor }}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={brandName}
            height={logoHeight}
            width={logoHeight * 4}
            className="object-contain"
            style={{ height: `${logoHeight}px`, width: "auto" }}
            quality={90}
            unoptimized={isLocalDev}
          />
        ) : (
          <span
            style={{ fontSize: logoHeight, lineHeight: "100%", ...s.textLogo }}
          >
            {brandName}
          </span>
        )}
      </div>
    </div>
  );
}
