"use client";

import { getAvatarColor } from "@/utils/avatar-color";
import { SmartAvatar } from "@v1/ui/avatar";

type Props = {
  bucket: "avatars" | "brand-avatars";
  /** The UUID to derive the fallback color from (user.id or brand.id) */
  id: string;
  path?: string | null;
  url?: string | null;
  name?: string | null;
  size?: number;
  loading?: boolean;
};

export function SignedAvatar({
  bucket,
  id,
  path,
  url,
  name,
  size = 36,
  loading,
}: Props) {
  let src: string | undefined;

  if (url) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      src = url;
    } else if (url.startsWith("data:") || url.startsWith("blob:")) {
      src = url;
    } else if (url.startsWith("/")) {
      src = url;
    } else {
      src = `/api/storage/${bucket}/${url
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    }
  } else if (path) {
    src = `/api/storage/${bucket}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  const effectiveColor = src ? undefined : getAvatarColor(id);

  return (
    <SmartAvatar
      size={size}
      name={name ?? undefined}
      src={src}
      color={effectiveColor}
      loading={loading}
    />
  );
}
