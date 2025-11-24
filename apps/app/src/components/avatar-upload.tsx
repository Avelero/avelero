"use client";

import { useBrandUpdateMutation } from "@/hooks/use-brand";
import { useUpload } from "@/hooks/use-upload";
import { useUserMutation } from "@/hooks/use-user";
import { createClient } from "@v1/supabase/client";
import { SmartAvatar as Avatar } from "@v1/ui/avatar";
import { cn } from "@v1/ui/cn";
import { toast } from "@v1/ui/sonner";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

type Entity = "user" | "brand";

interface AvatarUploadProps {
  entity: Entity;
  entityId: string;

  // display props
  avatarUrl?: string | null; // legacy prop, now path if provided
  name?: string | null;
  hue?: number | null;

  size?: number;
  className?: string;

  // optional external persistence override
  onUpload?: (url: string) => void;
}

const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB

export const AvatarUpload = forwardRef<HTMLInputElement, AvatarUploadProps>(
  (
    {
      entity,
      entityId,
      avatarUrl: initialUrl,
      name,
      hue,
      size = 52,
      className,
      onUpload,
    },
    ref,
  ) => {
    // Always store a displayable absolute URL here, or null
    const [avatar, setAvatar] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const prevUrlRef = useRef<string | null | undefined>(undefined);
    const { isLoading, uploadFile } = useUpload();

    // If parent provided a storage path, use proxy URL for optimized delivery. If absolute URL, use as-is.
    useEffect(() => {
      // Prevent unnecessary re-processing if URL hasn't changed
      if (prevUrlRef.current === initialUrl) {
        return;
      }
      prevUrlRef.current = initialUrl;

      const val = initialUrl?.trim();

      if (!val) {
        setAvatar(null);
        return;
      }

      const isAbsolute = /^https?:\/\//i.test(val) || val.startsWith("/");

      if (isAbsolute) {
        setAvatar(val);
        return;
      }

      const bucket = entity === "user" ? "avatars" : "brand-avatars";
      const encoded = val
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
      const proxyUrl = `/api/storage/${bucket}/${encoded}`;
      setAvatar(proxyUrl);
    }, [initialUrl, entity]);

    const userMutation = useUserMutation(); // updates users.avatar_url
    const brandMutation = useBrandUpdateMutation(); // updates brands.logo_path

    const clickPicker = useCallback(() => {
      const fileInput =
        ref && "current" in ref ? ref.current : inputRef.current;
      fileInput?.click();
    }, [ref]);

    const persistUrl = useCallback(
      (objectPath: string) => {
        if (onUpload) {
          onUpload(objectPath);
          return;
        }
        if (entity === "user") {
          userMutation.mutate(
            { avatar_url: objectPath },
            {
              onSuccess: () => {
                toast.success("Avatar changed successfully");
              },
              onError: () => {
                toast.error("Action failed, please try again");
              },
            },
          );
        } else {
          brandMutation.mutate(
            { id: entityId, logo_url: objectPath },
            {
              onSuccess: () => {
                toast.success("Logo changed successfully");
              },
              onError: () => {
                toast.error("Action failed, please try again");
              },
            },
          );
        }
      },
      [onUpload, entity, entityId, userMutation, brandMutation],
    );

    const validate = (file: File): string | null => {
      if (!ACCEPTED_MIME.includes(file.type)) {
        return "Only JPG, JPEG, or PNG files are allowed.";
      }
      if (file.size > MAX_SIZE) {
        return "File is larger than 4MB.";
      }
      return null;
    };

    const handleChange = useCallback(
      async (evt: React.ChangeEvent<HTMLInputElement>) => {
        const f = evt.target.files?.[0];
        if (!f) return;

        const msg = validate(f);
        if (msg) {
          return;
        }

        // Generate timestamp-based filename to prevent duplicates
        const fileExtension = f.name.split(".").pop() || "jpg";
        const timestamp = Date.now();
        const filename = `${timestamp}.${fileExtension}`;

        try {
          // Resolve folder id from auth for user uploads to satisfy RLS
          let folderId: string = entityId;
          if (entity === "user") {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            folderId = data?.user?.id ?? "";
          }
          if (!folderId) {
            return;
          }

          // Clean up old avatar files before uploading new one
          const bucket = entity === "user" ? "avatars" : "brand-avatars";
          try {
            const supabase = createClient();
            const { data: existingFiles } = await supabase.storage
              .from(bucket)
              .list(folderId);

            if (existingFiles && existingFiles.length > 0) {
              const filePaths = existingFiles.map(
                (file) => `${folderId}/${file.name}`,
              );
              await supabase.storage.from(bucket).remove(filePaths);
            }
          } catch (cleanupError) {
            // Don't fail the upload if cleanup fails, just log it
            console.warn("Failed to cleanup old avatar files:", cleanupError);
          }

          await uploadFile({
            bucket,
            path: [folderId, filename],
            file: f,
          });

          const objectPath = [folderId, filename].join("/");
          persistUrl(objectPath);
          const encoded = [folderId, filename]
            .map((s) => encodeURIComponent(s))
            .join("/");
          setAvatar(`/api/storage/${bucket}/${encoded}`);
        } catch (e) {
          toast.error("Action failed, please try again");
        } finally {
          // reset value so user can re-pick same file if needed
          evt.target.value = "";
        }
      },
      [entity, entityId, uploadFile, persistUrl],
    );

    const fileInputRef = ref || inputRef;

    return (
      <div
        className={cn(
          "relative inline-block cursor-pointer hover:opacity-90 transition-opacity",
          className,
        )}
        onClick={clickPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clickPicker();
          }
        }}
      >
        {(() => {
          const hasInitialPath = Boolean(
            initialUrl &&
            !/^https?:\/\//i.test(initialUrl) &&
            !initialUrl.startsWith("/"),
          );
          const isAwaitingSignedUrl = hasInitialPath && !avatar;
          const effectiveLoading = Boolean(isLoading) || isAwaitingSignedUrl;

          return (
            <Avatar
              size={size}
              name={name ?? undefined}
              src={avatar ?? undefined}
              hue={hue ?? undefined}
              loading={effectiveLoading}
            />
          );
        })()}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  },
);

AvatarUpload.displayName = "AvatarUpload";
