/**
 * Fallback placeholder shown when no image is provided or the URL is missing.
 *
 * Renders a light gray background with a centered image icon.
 */

const PLACEHOLDER_BG = "#F1F1F1";
const ICON_COLOR = "#C0C0C0";

export function ImagePlaceholder() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ backgroundColor: PLACEHOLDER_BG }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke={ICON_COLOR}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  );
}
