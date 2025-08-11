import { Suspense } from "react";
import { SignOut } from "@/components/auth/sign-out";
import { BrandSwitcherPopover } from "./brand-switcher-popover";
import { DangerZone } from "./danger-zone";

export function TestingControls() {
  const isEnabled = process.env.NEXT_PUBLIC_SHOW_TEST_CONTROLS !== "false";
  if (!isEnabled) return null;

  return (
    <section className="w-full max-w-2xl mx-auto my-6 rounded-lg border p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Testing controls</h2>
        <Suspense fallback={null}>
          <BrandSwitcherPopover />
        </Suspense>
      </div>

      <div className="flex items-center gap-3">
        <SignOut />
        <DangerZone />
      </div>
    </section>
  );
}



