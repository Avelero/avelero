"use client";

import {
  type CurrentUser,
  useUserQuery,
  useUserQuerySuspense,
} from "@/hooks/use-user";
import { Icons } from "@v1/ui/icons";
import { Suspense } from "react";
import { AvatarUpload } from "../avatar-upload";

function InnerAvatarUpload() {
  const { data: user } = useUserQuerySuspense();
  const u = user as CurrentUser;

  return (
    <AvatarUpload
      entity="user"
      entityId={u.id}
      avatarUrl={u.avatar_url}
      name={u.full_name}
      size={52}
    />
  );
}

function SetAvatar() {
  const { data: user } = useUserQuery();
  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Profile Picture</h6>
          <p className="text-secondary">
            Click on the profile picture on the right to upload your image.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-accent">
              <Icons.UserRound className="text-tertiary" />
            </div>
          }
        >
          <InnerAvatarUpload />
        </Suspense>
      </div>
    </div>
  );
}

export { SetAvatar };
