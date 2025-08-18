"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { type CurrentUser, useUserMutation, useUserQuery } from "@/hooks/use-user";

function SetName() {
  const userQuery = useUserQuery();
  const data = userQuery.data as CurrentUser | undefined;
  const updateUser = useUserMutation();

  const initialFullNameRef = useRef<string>("");
  const [fullName, setFullName] = useState<string>("");

  useEffect(() => {
    const initial = (data?.full_name ?? "");
    initialFullNameRef.current = initial;
    setFullName(initial);
  }, [data?.full_name]);

  const trimmed = fullName.trim();
  const isDirty = trimmed !== (initialFullNameRef.current ?? "").trim();
  const isEmpty = trimmed.length === 0;
  const isSaving = updateUser.status === "pending";

  function handleSave() {
    if (!isDirty || isEmpty || isSaving) return;
    updateUser.mutate(
      { full_name: trimmed },
      {
        onSuccess: () => {
          initialFullNameRef.current = trimmed;
          setFullName(trimmed);
        },
      },
    );
  }

  return (
    <div className="relative">
        <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
            <h6 className="text-foreground">Name</h6>
            <p className="text-secondary">Enter your full name on the right.</p>
        </div>
        <Input
            placeholder="Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
        />
        </div>
            <div className="flex flex-row justify-end border-x border-b p-6">
            <Button
              variant="default"
              disabled={!isDirty || isEmpty || isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
        </div>
    </div>
  );
}
  
export { SetName };