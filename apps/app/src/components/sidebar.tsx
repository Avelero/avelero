"use client";

import { useTRPC } from "@/trpc/client";
import { cn } from "@v1/ui/cn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { TrialSidebarCard } from "./billing/trial-sidebar-card";
import { EditorMenu } from "./editor-menu";
import { MainMenu } from "./main-menu";
import { BrandDropdown } from "./select/brand-select";

interface SidebarProps {
  variant?: "default" | "editor";
  hasTopBanner?: boolean;
}

export function Sidebar({
  variant = "default",
  hasTopBanner = false,
}: SidebarProps) {
  // Offset the fixed rail when a billing banner is mounted above the header.
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBrandPopupOpen, setIsBrandPopupOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  const trpc = useTRPC();
  const initQuery = useQuery(trpc.composite.initDashboard.queryOptions());
  const access = initQuery.data?.access;

  const isTrialPhase =
    access?.decision === "trial_active" && Boolean(access.trialEndsAt);
  const daysRemaining = isTrialPhase
    ? Math.max(
        0,
        Math.ceil(
          (new Date(access.trialEndsAt!).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const isMouseOverSidebar = () => {
    if (!sidebarRef.current) return false;
    const rect = sidebarRef.current.getBoundingClientRect();
    const { x, y } = mousePositionRef.current;
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  };

  const handleMouseEnter = () => setIsExpanded(true);
  const handleMouseLeave = () => {
    if (!isBrandPopupOpen) setIsExpanded(false);
  };

  const handleBrandPopupChange = (isOpen: boolean) => {
    setIsBrandPopupOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        if (!isMouseOverSidebar()) {
          setIsExpanded(false);
        }
      }, 100);
    }
  };

  const topOffsetClass = hasTopBanner
    ? "top-28 h-[calc(100vh-112px)] sm:top-24 sm:h-[calc(100vh-96px)]"
    : "top-14 h-[calc(100vh-56px)]";

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed z-50 flex",
        "flex-col flex-shrink-0 p-2 gap-2",
        "bg-background border-r border-border",
        "desktop:overflow-hidden desktop:rounded-tl-[10px] desktop:rounded-bl-[10px]",
        "transition-all duration-200 ease-out",
        topOffsetClass,
        isExpanded ? "w-60" : "w-14", // 56px collapsed rail is preserved
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {variant === "default" && (
        <>
          <BrandDropdown
            isExpanded={isExpanded}
            onPopupChange={handleBrandPopupChange}
          />
          <MainMenu isExpanded={isExpanded} />

          {/* Spacer + Trial card at bottom */}
          {isTrialPhase && daysRemaining != null && (
            <>
              <div className="flex-1" />
              <TrialSidebarCard
                isExpanded={isExpanded}
                daysRemaining={daysRemaining}
              />
            </>
          )}
        </>
      )}

      {variant === "editor" && <EditorMenu isExpanded={isExpanded} />}
    </aside>
  );
}
