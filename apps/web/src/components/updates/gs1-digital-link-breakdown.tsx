"use client";

import { useState } from "react";

interface Segment {
  id: string;
  text: string;
  color: string;
  label: string;
  description: string;
}

const baseSegments: Segment[] = [
  {
    id: "domain",
    text: "https://yourbrand.com",
    color: "text-foreground",
    label: "Your domain",
    description:
      "Can be your own website, a subdomain like id.yourbrand.com, or a third-party resolver. The standard doesn't care whose domain it is.",
  },
  {
    id: "ai-gtin",
    text: "/01/",
    color: "text-blue-600 dark:text-blue-400",
    label: "Application Identifier /01/",
    description:
      "GS1 Application Identifier for GTIN. Tells any system reading this URL that the value that follows is a product identifier.",
  },
  {
    id: "gtin",
    text: "09506000134352",
    color: "text-emerald-700 dark:text-emerald-400",
    label: "GTIN",
    description:
      "Your product's GTIN, padded to 14 digits. The same number encoded in your existing barcode.",
  },
];

const extendedSegments: Segment[] = [
  {
    id: "ai-serial",
    text: "/21/",
    color: "text-blue-600 dark:text-blue-400",
    label: "Application Identifier /21/",
    description: "GS1 Application Identifier for serial number.",
  },
  {
    id: "serial",
    text: "ABC123",
    color: "text-violet-700 dark:text-violet-400",
    label: "Serial number",
    description:
      "A unique serial value. This identifies individual items rather than just product models.",
  },
];

export function GS1DigitalLinkBreakdown() {
  const [lockedSegment, setLockedSegment] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [showExtended, setShowExtended] = useState(false);

  const activeId = hoveredSegment ?? lockedSegment;
  const allSegments = showExtended
    ? [...baseSegments, ...extendedSegments]
    : baseSegments;
  const activeSegment = allSegments.find((s) => s.id === activeId) ?? null;

  function handleClick(id: string) {
    setLockedSegment((prev) => (prev === id ? null : id));
  }

  function handleMouseEnter(id: string) {
    if (!lockedSegment) {
      setHoveredSegment(id);
    }
  }

  function handleMouseLeave() {
    setHoveredSegment(null);
  }

  function handleToggleExtended() {
    setShowExtended((prev) => !prev);
    // Clear selection if the active segment is in the extended set
    if (showExtended && lockedSegment) {
      const isExtended = extendedSegments.some((s) => s.id === lockedSegment);
      if (isExtended) setLockedSegment(null);
    }
  }

  return (
    <div className="my-8 w-full">
      <div className="border border-border bg-card p-4">
        {/* URL display */}
        <p className="font-geist-mono text-small leading-relaxed">
          {allSegments.map((segment) => (
            <span
              key={segment.id}
              role="button"
              tabIndex={0}
              onClick={() => handleClick(segment.id)}
              onMouseEnter={() => handleMouseEnter(segment.id)}
              onMouseLeave={handleMouseLeave}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick(segment.id);
                }
              }}
              className={`cursor-pointer px-1 py-0.5 transition-colors duration-100 ${segment.color} ${
                activeId === segment.id ? "bg-foreground/10" : ""
              }`}
              aria-pressed={lockedSegment === segment.id}
              aria-label={`${segment.label}: ${segment.description}`}
            >
              {segment.text}
            </span>
          ))}
        </p>

        {/* Explanation area */}
        <div className="mt-3 min-h-[3rem]">
          {activeSegment ? (
            <p className="text-small text-foreground/70">
              <span className="font-medium text-foreground">
                {activeSegment.label}
              </span>
              {" — "}
              {activeSegment.description}
            </p>
          ) : (
            <p className="text-small text-foreground/40">
              Click a segment to learn what it does.
            </p>
          )}
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={handleToggleExtended}
          className="mt-3 cursor-pointer text-small text-foreground/50 underline transition-colors duration-150 hover:text-foreground/80"
        >
          {showExtended ? "Hide serial number" : "Show with serial number"}
        </button>
      </div>
    </div>
  );
}
