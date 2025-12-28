import { CreateVariantForm, VariantFormSkeleton } from "@/components/forms/passport";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = {
    title: "Create Variant | Avelero",
};

export default async function VariantCreatePage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    await connection();

    const { handle } = await params;

    batchPrefetch([
        trpc.products.get.queryOptions({
            handle,
            includeVariants: true,
            includeAttributes: true,
        }),
        trpc.composite.catalogContent.queryOptions(),
    ]);

    return (
        <HydrateClient>
            <Suspense fallback={<VariantFormSkeleton />}>
                <CreateVariantForm productHandle={handle} />
            </Suspense>
        </HydrateClient>
    );
}
