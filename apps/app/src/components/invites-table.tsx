"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/trpc/client";

interface Props {
  brandId: string;
}

export function InvitesTable({ brandId }: Props) {
  const trpc = useTRPC();
  const [rows, setRows] = useState<Array<{ id: string; email: string; role: string; status: string; expires_at: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const query = trpc.brand.listInvites.queryOptions({ brand_id: brandId });
        const res = await query.queryFn?.({ queryKey: query.queryKey } as any);
        if (!mounted) return;
        setRows((res as any).data ?? []);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load invites";
        if (!mounted) return;
        setError(message);
      }
    })();
    return () => { mounted = false; };
  }, [brandId]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!rows.length) return <div className="text-sm text-neutral-500">No invites yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-200">
              <td className="py-2 pr-4">{r.email}</td>
              <td className="py-2 pr-4">{r.role}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2 pr-4">{r.expires_at ? new Date(r.expires_at).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


