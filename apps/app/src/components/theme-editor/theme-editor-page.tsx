"use client";

/**
 * Theme editor page shell and providers.
 */
import { Header } from "@/components/header";
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { Sidebar } from "@/components/sidebar";
import {
  DesignEditorProvider,
  useDesignEditor,
} from "@/contexts/design-editor-provider";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { useThemeQuery } from "@/hooks/use-theme";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { DEMO_DATA, type DppData, type Passport } from "@v1/dpp-components";
import { DesignPreview } from "./design-preview";
import { DesignPanel } from "./panel";

interface ThemeEditorPageProps {
  initialPassport?: Passport;
  previewData?: DppData;
}

export function ThemeEditorPage({
  // Seed the editor with the hydrated passport and preview data.
  initialPassport,
  previewData,
}: ThemeEditorPageProps = {}) {
  const { data: user } = useUserQuery();
  const { data: theme } = useThemeQuery();
  const brandId = user?.brand_id ?? undefined;

  const passport = initialPassport ?? theme.passport;
  const data = previewData ?? DEMO_DATA;

  return (
    <DesignEditorProvider
      initialPassport={passport}
      previewData={data}
      brandId={brandId}
    >
      <ThemeEditorContent />
    </DesignEditorProvider>
  );
}

function ThemeEditorContent() {
  // Align the editor chrome with the global billing banners when they are visible.
  const { hasUnsavedChanges, resetDrafts } = useDesignEditor();
  const trpc = useTRPC();
  const initQuery = useQuery(trpc.composite.initDashboard.queryOptions());

  const { pendingUrl, confirmNavigation, cancelNavigation } =
    useNavigationBlocker({
      shouldBlock: hasUnsavedChanges,
      onDiscard: resetDrafts,
    });
  const hasTopBanner = initQuery.data?.access.banner !== "none";

  return (
    <div className="relative h-full">
      <Header variant="editor" hasTopBanner={hasTopBanner} />
      <div className="flex flex-row justify-start h-[calc(100%_-_56px)]">
        <Sidebar variant="editor" hasTopBanner={hasTopBanner} />
        <div className="relative w-[calc(100%_-_56px)] h-full ml-[56px]">
          <div className="flex h-full w-full">
            <DesignPanel />
            <div className="flex h-full min-h-full flex-1 flex-col">
              <DesignPreview />
            </div>
          </div>
        </div>
      </div>

      <UnsavedChangesModal
        open={pendingUrl !== null}
        onOpenChange={(open) => {
          if (!open) cancelNavigation();
        }}
        onDiscard={confirmNavigation}
        onKeepEditing={cancelNavigation}
      />
    </div>
  );
}
