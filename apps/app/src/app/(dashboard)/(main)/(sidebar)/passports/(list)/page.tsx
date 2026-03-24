/**
 * Passports list page with SKU-aware creation controls and warnings.
 */
import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { ErrorFallback } from "@/components/error-fallback";
import { ImportProductsModal } from "@/components/modals/import-products-modal";
import {
  DataSection,
  DataSectionSkeleton,
} from "@/components/passports/data-section";
import { ExportButton } from "@/components/passports/export-button";
import { SelectionProvider } from "@/components/passports/selection-context";
import { TableSection } from "@/components/passports/table-section";
import { TableSectionSkeleton } from "@/components/tables/passports/table-skeleton";
import { getDashboardInit, isSidebarContentBlocked } from "@/lib/brand-access";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Button } from "@v1/ui/button";
import Link from "next/link";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { connection } from "next/server";
import { Suspense } from "react";

export default async function PassportsPage() {
  await connection();

  const initDashboard = await getDashboardInit();
  if (isSidebarContentBlocked(initDashboard.access.overlay)) {
    return null;
  }

  batchPrefetch([
    trpc.brand.billing.getStatus.queryOptions(),
    trpc.summary.productStatus.queryOptions(),
    trpc.products.list.queryOptions({
      limit: 50,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
    trpc.brand.customDomains.get.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <SelectionProvider>
        <div className="flex flex-col h-full">
          <ControlBar>
            <ControlBarLeft>
              <ControlBarNavButton href="/passports">
                Passports
              </ControlBarNavButton>
            </ControlBarLeft>
            <ControlBarRight>
              <ExportButton />
              <ImportProductsModal />
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
                  <ErrorBoundary errorComponent={ErrorFallback}>
                    <Suspense fallback={<DataSectionSkeleton />}>
                      <DataSection />
                    </Suspense>
                  </ErrorBoundary>
                  <ErrorBoundary errorComponent={ErrorFallback}>
                    <Suspense fallback={<TableSectionSkeleton />}>
                      <TableSection />
                    </Suspense>
                  </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </SelectionProvider>
    </HydrateClient>
  );
}
