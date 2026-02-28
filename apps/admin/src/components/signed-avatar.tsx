"use client";

import { SmartAvatar } from "@v1/ui/avatar";

type Props = {
  url?: string | null;
  name?: string | null;
  size?: number;
  loading?: boolean;
};

export function SignedAvatar({
  url,
  name,
  size = 36,
  loading,
}: Props) {
  const src = url ?? undefined;

  return (
    <SmartAvatar
      size={size}
      name={name ?? undefined}
      src={src}
      loading={loading}
    />
  );
}
