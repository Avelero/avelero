"use client";

import { useCallback, useRef, useState, forwardRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@v1/ui/avatar";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { Loader2 } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { stripSpecialCharacters } from "@v1/utils";
import { useUserMutation } from "@/hooks/use-user";

interface AvatarUploadProps {
  userId: string;
  avatarUrl?: string | null;
  name?: string | null;
  hue?: number | null;
  size?: number;
  className?: string;
  onUpload?: (url: string) => void;
}

export const AvatarUpload = forwardRef<HTMLInputElement, AvatarUploadProps>(
  ({ userId, avatarUrl: initialAvatarUrl, name, hue, size = 52, className, onUpload }, ref) => {
    const [avatar, setAvatar] = useState(initialAvatarUrl);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { isLoading, uploadFile } = useUpload();
    const updateUserMutation = useUserMutation();



    const handleUpload = useCallback(
      async (evt: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = evt.target;
        const selectedFile = files as FileList;
        const file = selectedFile[0];
        
        if (!file) return;

        const filename = stripSpecialCharacters(file.name);

        try {
          const { url } = await uploadFile({
            bucket: "avatars",
            path: [userId, filename],
            file,
          });

          if (url) {
            setAvatar(url);
            // Persist immediately so callers don't need extra save UI
            updateUserMutation.mutate({ 
              avatar_url: url,
            });
            onUpload?.(url);
          }
        } catch (error) {
          console.error("Upload failed:", error);
        }
      },
      [userId, uploadFile, onUpload, updateUserMutation],
    );

    const handlePick = useCallback(() => {
      const fileInput = ref && 'current' in ref ? ref.current : inputRef.current;
      fileInput?.click();
    }, [ref]);

    const fileInputRef = ref || inputRef;

    return (
      <Avatar
        className={cn(
          "cursor-pointer hover:opacity-90 transition-opacity",
          className,
        )}
        width={size}
        height={size}
        onClick={handlePick}
      >
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center bg-accent">
            <Icons.UserRound className="text-tertiary" size={size * 0.5} />
          </div>
        ) : (
          <>
            <AvatarImage src={avatar || ""} alt={name || ""} />
            {!avatar && (hue == null || hue === undefined) ? (
              <div className="flex h-full w-full items-center justify-center bg-accent">
                <Icons.UserRound className="text-tertiary" size={size * 0.5} />
              </div>
            ) : (
              <AvatarFallback 
                name={name || undefined} 
                hue={hue || undefined}
              />
            )}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </Avatar>
    );
  }
);

AvatarUpload.displayName = "AvatarUpload";

