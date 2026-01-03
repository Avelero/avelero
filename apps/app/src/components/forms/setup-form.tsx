"use client";

import { AvatarUpload } from "@/components/avatar-upload";
import { Skeleton } from "@v1/ui/skeleton";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SmartAvatar } from "@v1/ui/avatar";

const schema = z.object({
  full_name: z.string().min(2, "Please enter your full name"),
});

export function SetupForm() {
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { data: user } = useUserQuery();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  // Track if we've done the initial mount reset
  const hasMountResetRef = useRef(false);

  // Reset all form state on mount and when navigating to this page
  useEffect(() => {
    setFullName("");
    setAvatarUrl(null);
    setIsSubmitting(false);
    setError("");
    hasMountResetRef.current = true;
  }, [pathname]);

  // Prefill if anything exists, but only after mount reset and if user data available.
  useEffect(() => {
    if (!hasMountResetRef.current) return;
    const u = user as CurrentUser | null | undefined;
    if (!u) return;
    if (!fullName && u.full_name) setFullName(u.full_name);
    if (!avatarUrl && u.avatar_url) setAvatarUrl(u.avatar_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Prefetch possible navigation routes
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/create-brand");
    router.prefetch("/invites");
  }, [router]);

  const updateUserMutation = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: async () => {
        setIsSubmitting(false);
        await queryClient.invalidateQueries({
          queryKey: trpc.user.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.user.brands.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
        const [brands, invites] = await Promise.all([
          queryClient.fetchQuery(trpc.user.brands.list.queryOptions()),
          queryClient.fetchQuery(trpc.user.invites.list.queryOptions()),
        ]);
        const hasBrands = Array.isArray(brands) && brands.length > 0;
        const hasInvites = Array.isArray(invites) && invites.length > 0;

        if (hasBrands) {
          router.push("/");
        } else if (hasInvites) {
          router.push("/invites");
        } else {
          router.push("/create-brand");
        }
      },
      onError: (err) => {
        setError(err.message || "Failed to save profile");
        setIsSubmitting(false);
      },
    }),
  );

  const onAvatarUpload = (url: string) => setAvatarUrl(url);

  const onSubmit = async () => {
    setIsSubmitting(true);
    setError("");
    const parsed = schema.safeParse({ full_name: fullName.trim() });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid input");
      setIsSubmitting(false);
      return;
    }

    try {
      updateUserMutation.mutate({
        full_name: parsed.data.full_name,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      setError(message);
      setIsSubmitting(false);
    }
  };

  const u = user as CurrentUser | null | undefined;
  const userId = u?.id ?? "";

  return (
    <div className="mx-auto w-full max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Complete your account</h6>
        <p className="text-secondary">Add your name and an optional avatar.</p>
      </div>

      <div className="flex flex-col items-center space-y-6 w-full">
        <AvatarUpload
          entity="user"
          entityId={userId}
          avatarUrl={avatarUrl}
          name={fullName || undefined}
          hue={null} // important: no fallback hue before submit
          size={72}
          onUpload={onAvatarUpload}
        />

        <div className="space-y-1.5 w-full">
          <Label>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError("");
            }}
            placeholder="John Doe"
            error={!!error}
          />

          {error ? (
            <p className="type-small text-destructive text-center">{error}</p>
          ) : null}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={isSubmitting || updateUserMutation.isPending || !userId}
      >
        {isSubmitting || updateUserMutation.isPending
          ? "Saving..."
          : "Continue"}
      </Button>
    </div>
  );
}

export function SetupFormSkeleton() {
  return (
    <div className="mx-auto w-full  max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Complete your account</h6>
        <p className="text-secondary">Add your name and an optional avatar.</p>
      </div>
      <div className="flex flex-col items-center gap-6 w-full">
        <SmartAvatar size={72} loading />
        <div className="flex flex-col gap-1 w-full">
          <Label>Full name</Label>
          <Skeleton className="h-[38px] w-full" />
        </div>
      </div>
      <Button className="w-full" disabled>
        Continue
      </Button>
    </div>
  );
}
