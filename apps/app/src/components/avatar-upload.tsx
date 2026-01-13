"use client";

import { useBrandUpdateMutation } from "@/hooks/use-brand";
import { useImageUpload } from "@/hooks/use-upload";
import { useUserMutation } from "@/hooks/use-user";
import { createClient } from "@v1/supabase/client";
import { SmartAvatar as Avatar } from "@v1/ui/avatar";
import { cn } from "@v1/ui/cn";
import { toast } from "@v1/ui/sonner";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { removeFolderContents, validateImageFile } from "@/utils/upload";
import { getAvatarColor } from "@/utils/avatar-color";

type Entity = "user" | "brand";

interface AvatarUploadProps {
  entity: Entity;
  entityId: string;

  // display props
  avatarUrl?: string | null; // legacy prop, now path if provided
  name?: string | null;

  size?: number;
  className?: string;

  // optional external persistence override
  onUpload?: (url: string) => void;

  /**
   * When true, disables the colored background with initials display.
   * Only uploaded images or the fallback UI (gray user icon) will be shown.
   * Useful for setup flows where the user hasn't fully created their account yet.
   */
  disableInitials?: boolean;
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
      size = 52,
      className,
      onUpload,
      disableInitials = false,
    },
    ref,
  ) => {
    // Always store a displayable absolute URL here, or null
    const [avatar, setAvatar] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const prevUrlRef = useRef<string | null | undefined>(undefined);
    const { uploadImage, isLoading } = useImageUpload();

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

    const handleChange = useCallback(
      async (evt: React.ChangeEvent<HTMLInputElement>) => {
        const f = evt.target.files?.[0];
        if (!f) return;

        const validation = validateImageFile(f, {
          maxBytes: MAX_SIZE,
          allowedMime: ACCEPTED_MIME,
        });
        if (!validation.valid) {
          toast.error(validation.error);
          // Reset file input so user can try again
          if (inputRef.current) {
            inputRef.current.value = "";
          }
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
            await removeFolderContents(bucket, folderId);
          } catch (cleanupError) {
            // Don't fail the upload if cleanup fails, just log it
            console.warn("Failed to cleanup old avatar files:", cleanupError);
          }

          const { displayUrl } = await uploadImage({
            bucket,
            path: [folderId, filename],
            file: f,
            isPublic: false,
            validation: {
              maxBytes: MAX_SIZE,
              allowedMime: ACCEPTED_MIME,
            },
          });

          const objectPath = [folderId, filename].join("/");
          persistUrl(objectPath);
          setAvatar(displayUrl);
        } catch (e) {
          toast.error("Action failed, please try again");
        } finally {
          // reset value so user can re-pick same file if needed
          evt.target.value = "";
        }
      },
      [entity, entityId, uploadImage, persistUrl],
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
          // Derive color from entityId only when initials are enabled, no avatar, and a name exists.
          // If disableInitials is true or no name, we want the default fallback (gray user icon)
          const effectiveColor =
            disableInitials || avatar || !name
              ? undefined
              : getAvatarColor(entityId);

          return (
            <Avatar
              size={size}
              name={name ?? undefined}
              src={avatar ?? undefined}
              color={effectiveColor}
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
