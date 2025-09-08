"use client";

import { CountrySelect } from "@/components/country-select";
import { useTRPC } from "@/trpc/client";
import { hueFromName } from "@/utils/avatar-hue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Please enter a brand name"),
  country_code: z.string().length(2).optional(),
});

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createBrandMutation = useMutation(
    trpc.brand.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        router.push("/");
      },
      onError: (err) => {
        setError(err.message || "Failed to create brand");
        setIsSubmitting(false);
      },
    }),
  );

  const onSubmit = async () => {
    setError("");
    setIsSubmitting(true);
    const parsed = schema.safeParse({
      name: name.trim(),
      country_code: countryCode || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid input");
      setIsSubmitting(false);
      return;
    }
    createBrandMutation.mutate({
      ...parsed.data,
      avatar_hue: hueFromName(parsed.data.name),
    });
  };

  return (
    <div className="mx-auto w-full  max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Create your brand</h6>
        <p className="text-secondary">
          Name your brand and select the country where it operates.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex flex-col gap-1 w-full">
          <Label>Brand name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
          />
        </div>
        <CountrySelect
          id="country_code"
          label="Country"
          placeholder="Select country"
          value={countryCode}
          onChange={(code) => setCountryCode(code)}
        />
      </div>

      {error ? (
        <p className="text-p text-destructive text-center">{error}</p>
      ) : null}

      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={isSubmitting || createBrandMutation.isPending}
      >
        {isSubmitting || createBrandMutation.isPending
          ? "Creating..."
          : "Create"}
      </Button>
    </div>
  );
}
