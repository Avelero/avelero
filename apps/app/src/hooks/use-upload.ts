import { createClient } from "@v1/supabase/client";
import { upload } from "@v1/supabase/storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

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
  const supabase: SupabaseClient = createClient();
  const [isLoading, setLoading] = useState<boolean>(false);

  const uploadFile = async ({ file, path, bucket }: UploadParams): Promise<UploadResult> => {
    setLoading(true);
    try {
      const result = await upload(supabase, { path, file, bucket });
      const servedPath = result.path.join("/");
      const url = `/api/images/${result.bucket}/${servedPath}`;
      return { url, path: result.path };
    } finally {
      setLoading(false);
    }
  };

  return { uploadFile, isLoading };
}