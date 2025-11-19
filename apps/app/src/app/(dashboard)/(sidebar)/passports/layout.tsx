import { getQueryClient, trpc } from "@/trpc/server";

export default async function PassportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // Prefetch form reference data used by both list and form pages
  // (categories, materials, facilities, colors, sizes, certifications, operators)
  await queryClient.prefetchQuery(
    trpc.composite.brandCatalogContent.queryOptions(),
  );

  return <>{children}</>;
}
