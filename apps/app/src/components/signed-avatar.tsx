"use client";

import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { SmartAvatar } from "@v1/ui/avatar";

type Props = {
  bucket: "avatars" | "brand-avatars";
  path?: string | null;
  name?: string | null;
  hue?: number | null;
  size?: number;
  loading?: boolean;
};

export function SignedAvatar({
  bucket,
  path,
  name,
  hue,
  size = 40,
  loading,
}: Props) {
  const signed = useSignedStorageUrl(bucket, path ?? null);
  return (
    <SmartAvatar
      size={size}
      name={name ?? undefined}
      src={signed ?? undefined}
      hue={hue ?? undefined}
      loading={loading}
    />
  );
}
