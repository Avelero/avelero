import { createClient } from "@v1/supabase/client";
import { upload } from "@v1/supabase/storage";
import type { Client } from "@v1/supabase/types";
import { useState, useRef } from "react";

interface UploadParams {
  file: File;
  path: string[];
  bucket: string;
}

interface UploadResult {
  url: string;
  path: string[];
}

export function useUpload() {
  // Lazy-initialize supabase client only when needed (client-side only)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

  const [isLoading, setLoading] = useState<boolean>(false);

  const uploadFile = async ({
    file,
    path,
    bucket,
  }: UploadParams): Promise<UploadResult> => {
    setLoading(true);

    try {
      const result = await upload(getSupabase(), { path, file, bucket });
      const servedPath = result.path.join("/");
      const url = `/api/images/${result.bucket}/${servedPath}`;
      return { url, path: result.path };
    } finally {
      setLoading(false);
    }
  };

  return { uploadFile, isLoading };
}
