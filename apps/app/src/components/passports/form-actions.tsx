"use client";

import { usePassportFormContext } from "@/contexts/passport-form-context";
import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";

export function PassportFormActions() {
  const router = useRouter();
  const { isSubmitting } = usePassportFormContext();

  const handleCancel = () => {
    // Navigate back to passports page, discarding any form data
    router.push("/passports");
  };

  return (
    <>
      <Button 
        variant="outline" 
        type="button" 
        onClick={handleCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button 
        variant="brand" 
        type="submit" 
        form="passport-form"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </>
  );
}

