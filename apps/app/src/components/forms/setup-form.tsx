"use client";

import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@v1/ui/button";
import { TextField } from "@/components/text-field";
import { AvatarUpload } from "@/components/avatar-upload";
import { useTRPC } from "@/trpc/client";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
import { hueFromName } from "@/utils/avatar-hue";
import { useUserQuery, CurrentUser } from "@/hooks/use-user";

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

  const updateUserMutation = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        // decide destination based on brand membership
        const brands = await queryClient.fetchQuery(
          trpc.brand.list.queryOptions(),
        );
        const hasBrands = Array.isArray(brands?.data) && brands.data.length > 0;
        router.push(hasBrands ? `/${locale}` : `/${locale}/brands/create`);
      },
      onError: (err) => setError(err.message || "Failed to save profile"),
    }),
  );

  const onAvatarUpload = (url: string) => {
    setAvatarUrl(url);
  };

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
        avatar_url: avatarUrl || undefined,
        avatar_hue: hueFromName(parsed.data.full_name)
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Update your account</h1>
        <p className="text-sm text-muted-foreground">Add your name and an optional avatar.</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <AvatarUpload 
          userId={(user as CurrentUser | null | undefined)?.id!}
          avatarUrl={avatarUrl}
          name={fullName || undefined}
          onUpload={onAvatarUpload}
        />
        <TextField
          id="full_name"
          label="Full name"
          placeholder="John Doe"
          helperText="This is your first and last name."
          value={fullName}
          onChange={setFullName}
        />
      </div>

      {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}

      <Button className="w-full" onClick={onSubmit} disabled={isSubmitting || updateUserMutation.isPending}>
        {isSubmitting || updateUserMutation.isPending ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}

