"use client";

import {
  type Notification,
  useNotifications,
} from "@/hooks/use-notifications";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import Link from "next/link";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";

interface NotificationActionData {
  kind?: string;
  label?: string;
  url?: string;
  expiresAt?: string;
  filename?: string;
  regenerate?: {
    type?: string;
    jobId?: string;
  };
}

const ACTION_PLACEHOLDER = "{{action}}";

function NotificationCenterContent() {
  const trpc = useTRPC();
  const { unreadCount, notifications, markManyAsSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  const seenInSessionRef = useRef(new Set<string>());

  const exportCorrectionsMutation = useMutation(
    trpc.bulk.import.exportCorrections.mutationOptions(),
  );

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.seenAt).map((n) => n.id),
    [notifications],
  );

  useEffect(() => {
    if (!open || unreadIds.length === 0) return;

    const idsToMark = unreadIds.filter(
      (id) => !seenInSessionRef.current.has(id),
    );

    if (idsToMark.length === 0) return;

    for (const id of idsToMark) {
      seenInSessionRef.current.add(id);
    }
    markManyAsSeen.mutate(
      { ids: idsToMark },
      {
        onError: () => {
          for (const id of idsToMark) {
            seenInSessionRef.current.delete(id);
          }
        },
      },
    );
  }, [open, unreadIds, markManyAsSeen]);

  const handleAction = async (
    notification: Notification,
    actionData: NotificationActionData,
  ) => {
    try {
      if (actionData.kind === "download") {
        if (actionData.url) {
          await downloadFile(
            actionData.url,
            actionData.filename ?? "notification-download",
          );
          return;
        }

        if (
          actionData.regenerate?.type === "import_corrections" &&
          actionData.regenerate.jobId
        ) {
          const response = await exportCorrectionsMutation.mutateAsync({
            jobId: actionData.regenerate.jobId,
          });

          if (response.status === "ready" && response.downloadUrl) {
            await downloadFile(
              response.downloadUrl,
              actionData.filename ?? "import-corrections.xlsx",
            );
            return;
          }

          toast.success(
            "Error report is being generated. Check your email shortly.",
          );
          return;
        }

        toast.error("Download is not available yet");
        return;
      }

      if (actionData.kind === "link" && actionData.url) {
        window.location.assign(actionData.url);
        return;
      }

      if (notification.actionUrl) {
        window.location.assign(notification.actionUrl);
      }
    } catch {
      toast.error("Failed to process notification action");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="relative w-[30px] rounded-full data-[state=open]:bg-accent"
          aria-label="Notifications"
        >
          <Icons.Bell className="h-[14px] w-[14px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0" align="end" sideOffset={10}>
        <div className="border-b border-border px-4 py-3">
          <p className="type-h6 font-medium text-foreground">Notifications</p>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-tertiary">
                <Icons.Inbox className="h-4 w-4" />
              </div>
              <p className="type-small text-secondary">
                No notifications yet.
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const actionData = parseActionData(notification.actionData);
              const icon = getNotificationIcon(notification.type);
              const bodyContent = renderBodyContent({
                notification,
                actionData,
                isActionPending: exportCorrectionsMutation.isPending,
                onAction: handleAction,
              });

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-3 last:border-b-0",
                    !notification.seenAt && "bg-accent/40",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full bg-accent text-secondary">
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="type-small line-clamp-1 font-medium text-foreground">
                        {notification.title}
                      </p>
                      <p className="type-xsmall shrink-0 text-tertiary">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {bodyContent ? (
                      <p className="mt-0.5 type-small text-secondary">
                        {bodyContent}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationCenterSkeleton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="w-[30px] rounded-full"
      disabled
      aria-label="Notifications"
    >
      <Icons.Bell className="h-[14px] w-[14px]" />
    </Button>
  );
}

export function NotificationCenter() {
  return (
    <Suspense fallback={<NotificationCenterSkeleton />}>
      <NotificationCenterContent />
    </Suspense>
  );
}

function parseActionData(actionData: unknown): NotificationActionData | null {
  if (!actionData || typeof actionData !== "object") return null;
  return actionData as NotificationActionData;
}

function renderBodyContent(params: {
  notification: Notification;
  actionData: NotificationActionData | null;
  isActionPending: boolean;
  onAction: (
    notification: Notification,
    actionData: NotificationActionData,
  ) => Promise<void>;
}): ReactNode {
  const { notification, actionData, isActionPending, onAction } = params;

  const message = notification.message ?? "";
  const inlineAction = renderInlineAction({
    notification,
    actionData,
    isActionPending,
    onAction,
  });

  if (!message) {
    return inlineAction;
  }

  if (!message.includes(ACTION_PLACEHOLDER)) {
    return message;
  }

  if (!inlineAction) {
    return message.split(ACTION_PLACEHOLDER).join("");
  }

  const [before, ...afterParts] = message.split(ACTION_PLACEHOLDER);
  const after = afterParts.join(ACTION_PLACEHOLDER);

  return (
    <>
      {before}
      {inlineAction}
      {after}
    </>
  );
}

function renderInlineAction(params: {
  notification: Notification;
  actionData: NotificationActionData | null;
  isActionPending: boolean;
  onAction: (
    notification: Notification,
    actionData: NotificationActionData,
  ) => Promise<void>;
}): ReactNode {
  const { notification, actionData, isActionPending, onAction } = params;

  if (actionData?.label) {
    if (actionData.kind === "link" && actionData.url) {
      return (
        <Link
          href={actionData.url}
          className="inline type-small text-secondary underline underline-offset-4 hover:text-foreground"
          prefetch
        >
          {actionData.label}
        </Link>
      );
    }

    return (
      <button
        type="button"
        className="inline type-small text-secondary underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isActionPending}
        onClick={() => onAction(notification, actionData)}
      >
        {actionData.label}
      </button>
    );
  }

  if (notification.actionUrl) {
    return (
      <Link
        href={notification.actionUrl}
        className="inline type-small text-secondary underline underline-offset-4 hover:text-foreground"
        prefetch
      >
        open
      </Link>
    );
  }

  return null;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "import_failure":
      return <Icons.AlertTriangle className="h-4 w-4 text-destructive" />;
    case "import_success":
      return <Icons.CheckCircle className="h-4 w-4 text-brand" />;
    case "export_ready":
    case "qr_export_ready":
      return <Icons.Download className="h-4 w-4" />;
    case "invite_accepted":
      return <Icons.UserRound className="h-4 w-4" />;
    default:
      return <Icons.Bell className="h-4 w-4" />;
  }
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return "now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Download failed");
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
