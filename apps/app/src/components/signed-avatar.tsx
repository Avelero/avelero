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
  // Determine the source URL for the avatar
  let src: string | undefined;
  
  if (url) {
    // If url is provided, use it directly (could be full URL or path)
    // If it's already a full URL (starts with http/https), use as-is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      src = url;
    } else if (url.startsWith("/")) {
      // If it starts with /, it's already a path like /api/storage/...
      src = url;
    } else {
      // Otherwise, treat it as a storage path and construct the proxy URL
      src = `/api/storage/${bucket}/${url
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    }
  } else if (path) {
    // If path is provided, construct the storage proxy URL
    src = `/api/storage/${bucket}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  // Only show hue color if there's no image source
  const effectiveHue = src ? null : hue;

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
