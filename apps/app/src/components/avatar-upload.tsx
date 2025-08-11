"use client";

import { useCallback, useMemo, useRef, useState } from "react";

interface AvatarUploadProps {
  value?: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
}

function fileToWebp(original: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Failed to encode WebP"));
            const webp = new File([blob], "avatar.webp", { type: "image/webp" });
            resolve(webp);
          },
          "image/webp",
          0.92,
        );
      };
      img.onerror = () => reject(new Error("Invalid image"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(original);
  });
}

export function AvatarUpload({ value, onChange }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const webp = await fileToWebp(file);
        const url = URL.createObjectURL(webp);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        onChange(webp, url);
      } catch {
        onChange(null, null);
      }
    },
    [onChange],
  );

  const style = useMemo(
    () => ({
      backgroundImage: preview ? `url(${preview})` : undefined,
    }),
    [preview],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handlePick}
        className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border hover:opacity-90 transition"
        aria-label="Upload avatar"
        style={style as React.CSSProperties}
      >
        {!preview && (
          <span className="text-muted-foreground text-xl" aria-hidden>
            ⦿
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

