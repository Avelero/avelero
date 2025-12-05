"use client";

import { cn } from "@v1/ui/cn";

// =============================================================================
// TYPES
// =============================================================================

export type TabType = "styles" | "content";

interface StyleContentTabsProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    /** Whether to show the Content tab (some components only have styles) */
    showContentTab?: boolean;
}

// =============================================================================
// STYLE CONTENT TABS
// =============================================================================

/**
 * Tab switcher for the component editor.
 * Shows "Styles" and "Content" tabs when a component has both.
 */
export function StyleContentTabs({
    activeTab,
    onTabChange,
    showContentTab = true,
}: StyleContentTabsProps) {
    if (!showContentTab) {
        // If only styles, don't show tabs at all
        return null;
    }

    return (
        <div className="flex border-b border-border">
            <button
                type="button"
                onClick={() => onTabChange("styles")}
                className={cn(
                    "flex-1 h-9 type-small font-medium transition-colors",
                    activeTab === "styles"
                        ? "text-primary border-b-2 border-primary"
                        : "text-secondary hover:text-primary",
                )}
            >
                Styles
            </button>
            <button
                type="button"
                onClick={() => onTabChange("content")}
                className={cn(
                    "flex-1 h-9 type-small font-medium transition-colors",
                    activeTab === "content"
                        ? "text-primary border-b-2 border-primary"
                        : "text-secondary hover:text-primary",
                )}
            >
                Content
            </button>
        </div>
    );
}
