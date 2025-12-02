"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";

export function SetTheme() {
  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-4">
        <div className="flex flex-row justify-between items-center">
            <p className="type-p !font-medium text-primary">Theme</p>
            <Button
                variant="outline"
                size="icon-sm"
                iconPosition="right"
                icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
            >
                <Link href="/theme-editor" prefetch>
                    <span className="px-1">Edit theme</span>
                </Link>
            </Button>
        </div>
    </div>
  );
}
