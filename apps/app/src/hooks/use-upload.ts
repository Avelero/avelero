import { createClient } from "@v1/supabase/client";
import { upload } from "@v1/supabase/storage";
import type { Client } from "@v1/supabase/types";
import { useState } from "react";

interface UploadParams {
  file: File;
  path: string[];
  bucket: string;
  metadata?: Record<string, string>;
}

interface UploadResult {
  url: string;
  path: string[];
}

export function useUpload() {
  const supabase = createClient();
  const [isLoading, setLoading] = useState<boolean>(false);

  const uploadFile = async ({
    file,
    path,
    bucket,
    metadata,
  }: UploadParams): Promise<UploadResult> => {
    setLoading(true);

    try {
      const result = await upload(supabase, { path, file, bucket, metadata });
      const servedPath = result.path.join("/");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${servedPath}`
        : `/api/images/${result.bucket}/${servedPath}`;
      return { url, path: result.path };
    } finally {
      setLoading(false);
    }
  };

  return { uploadFile, isLoading };
}
