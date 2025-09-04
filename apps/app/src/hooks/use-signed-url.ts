"use client";

import { createClient } from "@v1/supabase/client";
import { useEffect, useState } from "react";

export function useSignedStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
  expiresIn = 60 * 60 * 24 * 30,
) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!bucket || !path) {
      setUrl(null);
      return () => {
        active = false;
      };
    }
    const supabase = createClient();
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [bucket, path, expiresIn]);
  return url;
}
