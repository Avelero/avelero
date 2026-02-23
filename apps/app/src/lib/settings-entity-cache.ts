import type { QueryClient } from "@tanstack/react-query";

export async function invalidateSettingsEntityCaches({
  queryClient,
  entityListQueryKey,
  compositeCatalogQueryKey,
}: {
  queryClient: QueryClient;
  entityListQueryKey: readonly unknown[];
  compositeCatalogQueryKey: readonly unknown[];
}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityListQueryKey }),
    queryClient.invalidateQueries({ queryKey: compositeCatalogQueryKey }),
  ]);
}
