"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@v1/ui/command";

export function BrandSwitcherClient() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";

  const { data: brandsData } = useSuspenseQuery(trpc.brand.list.queryOptions());
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions());

  const setActiveMutation = useMutation(
    trpc.brand.setActive.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        router.refresh();
      },
    }),
  );

  const onSelectBrand = (id: string) => {
    setActiveMutation.mutate({ id });
  };

  const onCreateBrand = () => router.push(`/${locale}/brands/create`);

  const brands = brandsData?.data ?? [];
  const activeId = me?.brand_id ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {activeId ? brands.find((b) => b.id === activeId)?.name ?? "Switch brand" : "Switch brand"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="end">
        <Command>
          <CommandList>
            <CommandEmpty>No brands</CommandEmpty>
            <CommandGroup heading="Your brands">
              {brands.map((b) => (
                <CommandItem
                  key={b.id}
                  onSelect={() => onSelectBrand(b.id)}
                  data-selected={b.id === activeId}
                >
                  <span className={b.id === activeId ? "font-medium" : ""}>{b.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem onSelect={onCreateBrand}>Create new brand…</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}



