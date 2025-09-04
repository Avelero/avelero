"use client";

import { AvatarUpload } from "@/components/avatar-upload";
import { CountrySelect } from "@/components/country-select";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

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
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? "en";

  // Prefill if anything exists, but initial setup usually has nothing.
  useEffect(() => {
    const u = user as CurrentUser | null | undefined;
    if (!u) return;
    if (!fullName && u.full_name) setFullName(u.full_name);
    if (!avatarUrl && u.avatar_path) setAvatarUrl(u.avatar_path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateUserMutation = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        const brands = await queryClient.fetchQuery(
          trpc.brand.list.queryOptions(),
        );
        const hasBrands = Array.isArray(brands?.data) && brands.data.length > 0;
        router.push(hasBrands ? `/${locale}` : `/${locale}/brands/create`);
      },
      onError: (err) => setError(err.message || "Failed to save profile"),
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
      // Do not compute hue here. Server will set hue from full_name.
      updateUserMutation.mutate({
        full_name: parsed.data.full_name,
        ...(avatarUrl ? { avatar_path: avatarUrl } : {}),
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

      <div className="flex flex-col items-center gap-6 w-full">
        <AvatarUpload
          entity="user"
          entityId={userId}
          avatarUrl={avatarUrl}
          name={fullName || undefined}
          hue={null} // important: no fallback hue before submit
          size={72}
          onUpload={onAvatarUpload}
        />

        <div className="flex flex-col gap-1 w-full">
          <Label>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : null}

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
