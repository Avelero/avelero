"use client";

import { Button } from "@v1/ui/button";
import Link from "next/link";

interface BaseProps {
  title: string;
  description?: string;
  action?:
    | { label: string; onClick: () => void }
    | { label: string; href: string };
}

function EmptyPanel({ title, description, action }: BaseProps) {
  return (
    <div className="flex w-full h-[240px] items-center justify-center border border-border">
      <div className="flex max-w-[520px] flex-col items-center gap-3 text-center">
        <h3 className="type-h5 text-primary">{title}</h3>
        {description ? (
          <p className="type-p text-secondary">{description}</p>
        ) : null}
        {action ? (
          <div className="pt-2">
            {"href" in action ? (
              <Button asChild variant="default" size="default">
                <Link href={action.href} prefetch>
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick} variant="default" size="default">
                {action.label}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NoPassports() {
  return (
    <EmptyPanel
      title="No passports yet"
      description="Create your first Digital Product Passport to get started."
      action={{ label: "Create passport", href: "/passports/create" }}
    />
  );
}

export function NoResults({ onClearAction }: { onClearAction?: () => void }) {
  return (
    <EmptyPanel
      title="No results"
      description="Change your search query or filters."
      action={
        onClearAction
          ? { label: "Clear filters", onClick: onClearAction }
          : undefined
      }
    />
  );
}

export const EmptyState = { NoPassports, NoResults } as const;
