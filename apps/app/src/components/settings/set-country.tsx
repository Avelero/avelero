"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";
import { CountrySelect } from "../select/country-select";

interface Brand {
  id: string;
  name: string;
  logo_path?: string | null;
  avatar_hue?: number | null;
  country_code?: string | null;
}

function SetCountry() {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const updateBrand = useBrandUpdateMutation();

  const brands = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  const initialCountryRef = useRef<string>("");
  const [country, setCountry] = useState<string>("");

  useEffect(() => {
    const initial = activeBrand?.country_code ?? "";
    initialCountryRef.current = initial;
    setCountry(initial);
  }, [activeBrand?.country_code]);

  const isDirty = country !== (initialCountryRef.current ?? "");
  const isSaving = updateBrand.status === "pending";

  function handleSave() {
    if (!isDirty || isSaving || !activeBrand) return;
    updateBrand.mutate(
      { id: activeBrand.id, country_code: country || null },
      {
        onSuccess: () => {
          initialCountryRef.current = country;
          toast.success("Brand country changed successfully");
        },
        onError: () => {
          toast.error("Action failed, please try again");
        },
      },
    );
  }

  function handleCountryChange(code: string) {
    setCountry(code);
  }

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Country</h6>
          <p className="text-secondary">
            Select your brand's country on the right.
          </p>
        </div>
        <CountrySelect
          id="brand-country"
          placeholder="Select country"
          value={country}
          onChange={handleCountryChange}
          className="max-w-[250px]"
        />
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export { SetCountry };
