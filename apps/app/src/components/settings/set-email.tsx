"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";

interface Brand {
  id: string;
  name: string;
  email?: string | null;
  logo_path?: string | null;
  avatar_hue?: number | null;
  country_code?: string | null;
}

function SetEmail() {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const updateBrand = useBrandUpdateMutation();

  const brands = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  const initialEmailRef = useRef<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const initial = activeBrand?.email ?? "";
    initialEmailRef.current = initial;
    setEmail(initial);
  }, [activeBrand?.email]);

  const trimmed = email.trim();
  const isValidEmail = /\S+@\S+\.\S+/.test(trimmed);
  const isDirty = trimmed !== (initialEmailRef.current ?? "").trim();
  const isSaving = updateBrand.status === "pending";
  const canSave = isValidEmail && isDirty;

  function handleSave() {
    if (!canSave || isSaving || !activeBrand) return;
    updateBrand.mutate(
      { id: activeBrand.id, email: trimmed || null },
      {
        onSuccess: () => {
          initialEmailRef.current = trimmed;
          setEmail(trimmed);
          toast.success("Brand email changed successfully");
        },
        onError: () => {
          toast.error("Action failed, please try again");
        },
      },
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Email</h6>
          <p className="text-secondary">
            Enter the email address for brand communications on the right.
          </p>
        </div>
        <Input
          type="email"
          placeholder="Brand email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-[250px]"
        />
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={!canSave || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export { SetEmail };
