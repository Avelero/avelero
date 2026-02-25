"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import Link from "next/link";
import { useState } from "react";

const PAGE_SIZE = 100;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function AdminBrandsList() {
  const trpc = useTRPC();

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const brandsQuery = useQuery({
    ...trpc.admin.brands.list.queryOptions({
      search: search.length > 0 ? search : undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }),
  });

  const total = brandsQuery.data?.total ?? 0;
  const items = brandsQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground">Brands</h2>
          <p className="text-secondary">Search and manage provisioned brands.</p>
        </div>

        <Button asChild>
          <Link href="/admin/brands/new" prefetch>
            <Icons.Plus className="mr-2 h-4 w-4" />
            Create brand
          </Link>
        </Button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
        }}
      >
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search by name, slug, or email"
          className="w-full max-w-[360px]"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="border">
        <div className="border-b px-4 py-3">
          <p className="type-small text-secondary">
            Showing {items.length} of {total}
          </p>
        </div>

        {brandsQuery.isLoading ? (
          <p className="px-4 py-6 text-secondary">Loading brands...</p>
        ) : brandsQuery.isError ? (
          <p className="px-4 py-6 text-destructive">
            Failed to load brands. Please try again.
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-secondary">No brands match this search.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Brand
                  </TableHead>
                  <TableHead>
                    Qualification
                  </TableHead>
                  <TableHead>
                    Billing
                  </TableHead>
                  <TableHead>
                    Members
                  </TableHead>
                  <TableHead>
                    Invites
                  </TableHead>
                  <TableHead>
                    Updated
                  </TableHead>
                  <TableHead className="text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((brand) => (
                  <TableRow key={brand.id} className="align-top">
                    <TableCell>
                      <p className="text-foreground">{brand.name}</p>
                      <p className="type-small text-secondary">{brand.id}</p>
                    </TableCell>
                    <TableCell className="type-small text-secondary">
                      {brand.control.qualification_status}
                    </TableCell>
                    <TableCell className="type-small text-secondary">
                      {brand.control.billing_status}
                    </TableCell>
                    <TableCell className="type-small text-secondary">
                      {brand.member_count}
                    </TableCell>
                    <TableCell className="type-small text-secondary">
                      {brand.pending_invite_count}
                    </TableCell>
                    <TableCell className="type-small text-secondary">
                      {formatDateTime(brand.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/brands/${brand.id}`} prefetch>
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {total > items.length ? (
        <p className="type-small text-secondary">
          Refine your search to see additional brands.
        </p>
      ) : null}
    </div>
  );
}
