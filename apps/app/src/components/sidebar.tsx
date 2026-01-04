"use client";

import { cn } from "@v1/ui/cn";
import { useEffect, useRef, useState } from "react";
import { BrandDropdown } from "./select/brand-select";
import { MainMenu } from "./main-menu";
import { EditorMenu } from "./editor-menu";

interface SidebarProps {
  variant?: "default" | "editor";
}

export function Sidebar({ variant = "default" }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBrandPopupOpen, setIsBrandPopupOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

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

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed top-0 z-50 hidden md:flex h-screen mt-14",
        "flex-col flex-shrink-0 p-2 gap-2",
        "bg-background border-r border-border",
        "desktop:overflow-hidden desktop:rounded-tl-[10px] desktop:rounded-bl-[10px]",
        "transition-all duration-200 ease-out",
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
        </>
      )}

      {variant === "editor" && <EditorMenu isExpanded={isExpanded} />}
    </aside>
  );
}
