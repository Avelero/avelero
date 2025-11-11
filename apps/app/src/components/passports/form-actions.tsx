"use client";

import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";

export function PassportFormActions() {
  const router = useRouter();

  const handleCancel = () => {
    // Navigate back to passports page, discarding any form data
    router.push("/passports");
  };

  return (
    <>
      <Button variant="outline" onClick={handleCancel}>
        Cancel
      </Button>
      <Button 
        variant="brand" 
        type="submit" 
        form="passport-form"
      >
        Save
      </Button>
    </>
  );
}

