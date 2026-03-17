/**
 * Empty states for the passports listing experience.
 */
"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import Link from "next/link";

interface BaseProps {
  title: string;
  description?: string;
  action?:
    | { label: string; onClick: () => void }
    | { label: string; href: string }
    | { label: string; disabledReason: string };
}

function EmptyPanel({ title, description, action }: BaseProps) {
  return (
    <div className="flex w-full h-[280px] items-center justify-center border border-border">
      <div className="flex max-w-[520px] flex-col items-center gap-3 text-center">
        <h3 className="type-h5 text-primary">{title}</h3>
        {description ? (
          <p className="type-p text-secondary">{description}</p>
        ) : null}
        {action ? (
          <div className="pt-2">
            {"disabledReason" in action ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="default" size="default" disabled>
                        {action.label}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{action.disabledReason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : "href" in action ? (
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
  const trpc = useTRPC();
  const initQuery = useQuery(trpc.composite.initDashboard.queryOptions());
  const isSkuBlocked = initQuery.data?.sku.status === "blocked";

  return (
    <EmptyPanel
      title="No passports yet"
      description="Create your first Digital Product Passport to get started."
      action={
        isSkuBlocked
          ? {
              label: "Create passport",
              disabledReason:
                "You've reached your SKU limit. Upgrade your plan to add more products.",
            }
          : { label: "Create passport", href: "/passports/create" }
      }
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
