import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { ImportProductsModal } from "@/components/modals/import-products-modal";
import { DataSection } from "@/components/passports/data-section";
import { ExportButton } from "@/components/passports/export-button";
import { SelectionProvider } from "@/components/passports/selection-context";
import { TableSection } from "@/components/passports/table-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Button } from "@v1/ui/button";
import Link from "next/link";
import { connection } from "next/server";

export default async function PassportsPage() {
  await connection();

  batchPrefetch([
    trpc.summary.productStatus.queryOptions(),
    trpc.products.list.queryOptions({
      limit: 50,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
    // Prefetch notification data for ImportProductsModal
    trpc.notifications.getUnreadCount.queryOptions(),
    trpc.notifications.getRecent.queryOptions({
      limit: 10,
      unreadOnly: false,
      includeDismissed: false,
    })
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
                <DataSection />
                <TableSection />
              </div>
            </div>
          </div>
        </div>
      </SelectionProvider>
    </HydrateClient>
  );
}
