import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { ExportProductsModalSkeleton } from "@/components/modals/export-products-modal";
import { ImportProductsModalSkeleton } from "@/components/modals/import-products-modal";
import { DataSectionSkeleton } from "@/components/passports/data-section";
import { TableSectionSkeleton } from "@/components/tables/passports/table-skeleton";
import { Button } from "@v1/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

/**
 * Combined skeleton for the entire passports page.
 * Includes control bar and page content - visually identical to the actual page.
 * Shown during navigation while the page's async prefetch completes.
 */
function PassportsPageSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/passports">Passports</ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight>
          <ExportProductsModalSkeleton />
          <ImportProductsModalSkeleton />
          <Button
            variant="default"
            size="default"
            asChild
            className="min-w-[82px]"
          >
            <Link href="/passports/create" prefetch>
              <span className="px-1">Create</span>
            </Link>
          </Button>
        </ControlBarRight>
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-8 overflow-y-auto scrollbar-hide">
        <div className="w-full">
          <div className="flex flex-col gap-12">
            <DataSectionSkeleton />
            <TableSectionSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PassportsListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<PassportsPageSkeleton />}>{children}</Suspense>;
}
