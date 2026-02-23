"use client";

import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import type { RowAction } from "./types";

export function RowActionsMenu({
  actions,
  triggerClassName,
}: {
  actions: RowAction[];
  triggerClassName?: string;
}) {
  if (actions.length === 0) return null;

  const [open, setOpen] = React.useState(false);
  const suppressCloseAutoFocusRef = React.useRef(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center rounded text-secondary hover:text-primary hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-primary data-[state=open]:opacity-100",
            open && "bg-accent text-primary opacity-100",
            triggerClassName,
          )}
          aria-label="Open row actions"
        >
          <Icons.EllipsisVertical className="h-[14px] w-[14px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px]"
        onCloseAutoFocus={(event) => {
          if (!suppressCloseAutoFocusRef.current) return;
          suppressCloseAutoFocusRef.current = false;
          event.preventDefault();
        }}
      >
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
            onSelect={() => {
              suppressCloseAutoFocusRef.current = true;
              setOpen(false);
              requestAnimationFrame(() => {
                void action.onSelect();
              });
            }}
          >
            <span className="inline-flex items-center gap-2">
              {action.icon}
                <span>{action.label}</span>
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
