"use client";

import { SmartAvatar } from "@v1/ui/avatar";

type Props = {
  bucket: "avatars" | "brand-avatars";
  path?: string | null;
  url?: string | null;
  name?: string | null;
  hue?: number | null;
  size?: number;
  loading?: boolean;
};

export function SignedAvatar({
  bucket,
  path,
  url,
  name,
  hue,
  size = 40,
  loading,
}: Props) {
  const effectiveHue = path || url ? null : hue;
  const src = url
    ? url
    : path
      ? `/api/storage/${bucket}/${path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : undefined;

  return (
    <SmartAvatar
      size={size}
      name={name ?? undefined}
      src={src}
      hue={effectiveHue ?? undefined}
      loading={loading}
    />
  );
}
