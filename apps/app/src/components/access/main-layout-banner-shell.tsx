"use client";

/**
 * Client shell that manages top billing banner visibility across in-app navigation.
 */
import { cn } from "@v1/ui/cn";
import { useState } from "react";
import { PastDueBanner } from "./past-due-banner";
import { PendingCancellationBanner } from "./pending-cancellation-banner";

type MainLayoutBanner = "none" | "past_due" | "pending_cancellation";

interface MainLayoutBannerShellProps {
  banner: MainLayoutBanner;
  accessUntil: string | null;
  children: React.ReactNode;
}

export function MainLayoutBannerShell({
  banner,
  accessUntil,
  children,
}: MainLayoutBannerShellProps) {
  // Keep the pending-cancellation dismissal local to the current page session.
  const [isPendingCancellationDismissed, setIsPendingCancellationDismissed] =
    useState(false);
  const showPastDueBanner = banner === "past_due";
  const showPendingCancellationBanner =
    banner === "pending_cancellation" && !isPendingCancellationDismissed;
  const hasVisibleTopBanner =
    showPastDueBanner || showPendingCancellationBanner;

  return (
    <div
      className={cn(
        "relative h-full min-h-0",
        hasVisibleTopBanner
          ? "[--app-top-banner-height:56px] sm:[--app-top-banner-height:40px]"
          : "[--app-top-banner-height:0px]",
      )}
    >
      {showPastDueBanner ? <PastDueBanner /> : null}
      {showPendingCancellationBanner ? (
        <PendingCancellationBanner
          accessUntil={accessUntil}
          onDismiss={() => setIsPendingCancellationDismissed(true)}
        />
      ) : null}
      <div className="relative h-full min-h-0">{children}</div>
    </div>
  );
}
