"use client";

import { AvatarUpload } from "./avatar-upload";
import { useUserQuery, useUserQuerySuspense, CurrentUser } from "@/hooks/use-user";
import { Suspense } from "react";
import { Icons } from "@v1/ui/icons";

function InnerAvatarUpload() {
    const { data: user } = useUserQuerySuspense();
    return (
        <AvatarUpload
            entity="user"
            entityId={(user as CurrentUser).id}
            avatarUrl={(user as any).avatar_path}
            name={(user as CurrentUser).full_name}
            hue={(user as CurrentUser).avatar_hue}
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
                    <p className="text-secondary">Click on the profile picture on the right to upload your image.</p>
                </div>
                <Suspense fallback={<div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-accent"><Icons.UserRound className="text-tertiary" /></div>}>
                    <InnerAvatarUpload />
                </Suspense>
            </div>
        </div>
    );
}

export { SetAvatar };
