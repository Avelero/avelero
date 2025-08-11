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

const schema = z.object({
  full_name: z.string().min(2, "Please enter your full name"),
});

export function SetupForm() {
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
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

  const onAvatarChange = (file: File | null, preview: string | null) => {
    setAvatarFile(file);
    setAvatarPreview(preview);
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
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const supabase = createSupabaseClient();
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) throw new Error("Unauthorized");
        const objectPath = `${userData.user.id}/${Date.now()}.webp`;
        const arrayBuffer = await avatarFile.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(objectPath, new Uint8Array(arrayBuffer), {
            contentType: "image/webp",
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(objectPath);
        avatarUrl = pub.publicUrl;
      }

      updateUserMutation.mutate({ full_name: parsed.data.full_name, avatar_url: avatarUrl });
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
        <AvatarUpload value={avatarPreview} onChange={onAvatarChange} />
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

