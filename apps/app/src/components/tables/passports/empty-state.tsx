"use client";

import { Button } from "@v1/ui/button";

interface BaseProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

function EmptyPanel({ title, description, action }: BaseProps) {
  return (
    <div className="flex w-full items-center justify-center py-16">
      <div className="flex max-w-[520px] flex-col items-center gap-3 text-center">
        <h3 className="text-h5 text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? (
          <div className="pt-2">
            <Button onClick={action.onClick} variant="brand" size="sm">
              {action.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NoPassports({
  onCreateAction,
}: { onCreateAction?: () => void }) {
  return (
    <EmptyPanel
      title="No passports yet"
      description="Create your first Digital Product Passport to get started."
      action={
        onCreateAction
          ? { label: "Create passport", onClick: onCreateAction }
          : undefined
      }
    />
  );
}

export function NoResults({ onClearAction }: { onClearAction?: () => void }) {
  return (
    <EmptyPanel
      title="No results"
      description="Try adjusting your filters or search query."
      action={
        onClearAction
          ? { label: "Clear filters", onClick: onClearAction }
          : undefined
      }
    />
  );
}

export const EmptyState = { NoPassports, NoResults } as const;
