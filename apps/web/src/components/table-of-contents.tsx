"use client";

import type { TocHeading } from "@/lib/updates";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface TableOfContentsProps {
  headings: TocHeading[];
}

function TocList({
  headings,
  activeId,
  onClickHeading,
  showTrack,
}: {
  headings: TocHeading[];
  activeId: string;
  showTrack: boolean;
  onClickHeading: (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [trackHeight, setTrackHeight] = useState<number | undefined>(
    undefined,
  );
  const [indicator, setIndicator] = useState<{
    top: number;
    height: number;
  } | null>(null);

  // Measure track height once on mount + when headings change
  useEffect(() => {
    if (!showTrack) return;
    const list = listRef.current;
    if (!list) return;

    const measure = () => setTrackHeight(list.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [headings, showTrack]);

  // Measure active item position whenever activeId changes
  useEffect(() => {
    if (!showTrack) return;
    const list = listRef.current;
    if (!list) return;

    const activeIndex = headings.findIndex((h) => h.id === activeId);
    if (activeIndex < 0) {
      setIndicator(null);
      return;
    }

    const items = list.querySelectorAll<HTMLLIElement>("li");
    const activeItem = items[activeIndex];
    if (!activeItem) {
      setIndicator(null);
      return;
    }

    const listRect = list.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    setIndicator({
      top: itemRect.top - listRect.top,
      height: itemRect.height,
    });
  }, [headings, activeId, showTrack]);

  const items = (
    <ul ref={listRef} className="flex flex-col gap-[13px]">
      {headings.map((heading) => {
        const isActive = heading.id === activeId;

        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => onClickHeading(e, heading.id)}
              className={cn(
                "group flex items-center text-body font-medium leading-relaxed transition-colors duration-150",
                heading.level === 3 && "pl-4",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {heading.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (!showTrack) {
    return <nav aria-label="Table of contents">{items}</nav>;
  }

  return (
    <nav aria-label="Table of contents" className="flex items-start gap-7">
      {/* Track bar */}
      <div
        className="relative w-1 shrink-0"
        style={{ height: trackHeight ?? "auto" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-muted"
        />
        {indicator && (
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 w-1 rounded-full bg-foreground"
            style={{
              height: indicator.height,
              transform: `translateY(${indicator.top}px)`,
              transition:
                "transform 300ms cubic-bezier(0.215, 0.61, 0.355, 1), height 300ms cubic-bezier(0.215, 0.61, 0.355, 1)",
              willChange: "transform",
            }}
          />
        )}
      </div>

      {items}
    </nav>
  );
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(
    new Map(),
  );

  useEffect(() => {
    const callback: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        headingElementsRef.current.set(entry.target.id, entry);
      }

      const visibleHeadings: IntersectionObserverEntry[] = [];
      for (const entry of headingElementsRef.current.values()) {
        if (entry.isIntersecting) {
          visibleHeadings.push(entry);
        }
      }

      if (visibleHeadings.length > 0) {
        const sorted = visibleHeadings.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        );
        setActiveId(sorted[0].target.id);
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: "-80px 0px -60% 0px",
    });

    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    for (const el of headingElements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      setMobileOpen(false);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    },
    [],
  );

  if (headings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="hidden lg:block h-full">
        <div className="sticky top-28">
          <TocList
            headings={headings}
            activeId={activeId}
            showTrack
            onClickHeading={handleClick}
          />
        </div>
      </div>

      {/* Mobile: collapsible with animated expand */}
      <div className="lg:hidden w-full mb-8 border-b border-border">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMobileOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMobileOpen((prev) => !prev);
            }
          }}
          className="flex items-center justify-between w-full pb-3 text-body font-medium leading-relaxed text-muted-foreground cursor-pointer"
        >
          <span>Table of contents</span>
          <svg
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              mobileOpen && "rotate-180",
            )}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Animated container using grid row transition */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{
            gridTemplateRows: mobileOpen ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            <div className="pb-4">
              <TocList
                headings={headings}
                activeId={activeId}
                showTrack={false}
                onClickHeading={handleClick}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
