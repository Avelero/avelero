import { SetTheme } from "@/components/design/set-theme";
import { getQueryClient, trpc } from "@/trpc/server";
import { buildPublicUrl } from "@/utils/storage-urls";
import { BUCKETS } from "@/utils/storage-config";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";

async function SetThemeWithData() {
  const queryClient = getQueryClient();

  // Fetch theme data (includes screenshot paths and updatedAt)
  const theme = await queryClient.fetchQuery(
    trpc.brand.theme.get.queryOptions(),
  );

  // Build public URLs for screenshots
  const screenshotDesktopUrl = buildPublicUrl(
    BUCKETS.THEME_SCREENSHOTS,
    theme.screenshotDesktopPath,
  );
  const screenshotMobileUrl = buildPublicUrl(
    BUCKETS.THEME_SCREENSHOTS,
    theme.screenshotMobilePath,
  );

  return (
    <SetTheme
      updatedAt={theme.updatedAt ?? new Date().toISOString()}
      screenshotDesktopUrl={screenshotDesktopUrl}
      screenshotMobileUrl={screenshotMobileUrl}
    />
  );
}

export default async function DesignPage() {
  return (
    <div className="max-w-[700px] w-full">
      <div className="flex flex-col gap-12">
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <SetThemeWithData />
        </Suspense>
      </div>
    </div>
  );
}
