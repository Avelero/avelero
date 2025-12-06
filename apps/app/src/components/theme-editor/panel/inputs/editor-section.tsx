"use client";

interface EditorSectionProps {
    title: string;
    children: React.ReactNode;
}

/**
 * Shared section wrapper for grouping fields in the editor panel.
 * Used by both StylesSection and ContentSection.
 */
export function EditorSection({ title, children }: EditorSectionProps) {
    return (
        <div className="border-b border-border p-4">
            <span className="type-small font-medium text-primary mb-3 block">
                {title}
            </span>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
}
