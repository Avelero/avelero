"use client";

import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@v1/ui/button";
import { TextField } from "@/components/text-field";
import { CountrySelect } from "@/components/country-select";
import { useTRPC } from "@/trpc/client";

const schema = z.object({
  name: z.string().min(2, "Please enter a brand name"),
  country_code: z.string().length(2).optional(),
});

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState("");
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
      },
    }),
  );

  const onSubmit = async () => {
    setError("");
    const parsed = schema.safeParse({ name: name.trim(), country_code: countryCode || undefined });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    createBrandMutation.mutate(parsed.data);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Create your brand</h1>
        <p className="text-sm text-muted-foreground">Name your brand and select the country where it operates.</p>
      </div>

      <div className="space-y-4">
        <TextField id="brand_name" label="Brand name" placeholder="Acme Inc." value={name} onChange={setName} />
        <CountrySelect
          id="country_code"
          label="Country"
          placeholder="Select country"
          value={countryCode}
          onChange={(code) => setCountryCode(code)}
        />
      </div>

      {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}

      <Button className="w-full" onClick={onSubmit} disabled={createBrandMutation.isPending}>
        {createBrandMutation.isPending ? "Creating..." : "Create"}
      </Button>
    </div>
  );
}



