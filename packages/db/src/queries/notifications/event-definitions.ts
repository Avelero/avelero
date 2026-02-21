import type {
  CreateNotificationParams,
  NotificationActionData,
  NotificationResourceType,
  NotificationType,
} from "./types";

export type NotificationAudience =
  | "actor_only"
  | "brand_members"
  | "brand_members_except_actor";

export const NOTIFICATION_DEFAULT_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const ACTION_PLACEHOLDER = "{{action}}";

export type NotificationEventKey =
  | "import_success"
  | "import_failure"
  | "export_ready"
  | "qr_export_ready"
  | "invite_accepted";

export interface NotificationEventPayloadMap {
  import_success: {
    jobId: string;
    productsCreated: number;
    productsUpdated: number;
    totalProcessed: number;
  };
  import_failure: {
    jobId: string;
    totalIssues: number;
    blockedProducts: number;
    warningProducts: number;
    correctionDownloadUrl?: string | null;
    correctionExpiresAt?: string | null;
    correctionFilename?: string | null;
  };
  export_ready: {
    jobId: string;
    productsExported: number;
    downloadUrl: string;
    expiresAt: string;
    filename?: string | null;
  };
  qr_export_ready: {
    jobId: string;
    exportedVariants: number;
    downloadUrl: string;
    expiresAt: string;
    filename?: string | null;
  };
  invite_accepted: {
    inviteId: string;
    acceptedUserId: string;
    acceptedUserName?: string | null;
    acceptedUserEmail?: string | null;
    brandName?: string | null;
  };
}

export interface ResolvedNotificationEvent {
  type: NotificationType;
  title: string;
  message?: string | null;
  resourceType: NotificationResourceType;
  resourceId: string;
  actionUrl?: string | null;
  actionData?: NotificationActionData | null;
  expiresInMs?: number;
}

interface NotificationEventDefinition<K extends NotificationEventKey> {
  audience: NotificationAudience;
  resolve: (payload: NotificationEventPayloadMap[K]) => ResolvedNotificationEvent;
}

type NotificationEventDefinitions = {
  [K in NotificationEventKey]: NotificationEventDefinition<K>;
};

export const notificationEventDefinitions: NotificationEventDefinitions = {
  import_success: {
    audience: "brand_members",
    resolve: (payload) => ({
      type: "import_success",
      title: `Import completed: ${payload.totalProcessed} products processed`,
      message: `${payload.productsCreated} created, ${payload.productsUpdated} updated. ${ACTION_PLACEHOLDER}`,
      resourceType: "import_job",
      resourceId: payload.jobId,
      actionUrl: "/passports",
      actionData: {
        kind: "link",
        label: "view passports",
        url: "/passports",
      },
      expiresInMs: NOTIFICATION_DEFAULT_EXPIRES_MS,
    }),
  },
  import_failure: {
    audience: "brand_members",
    resolve: (payload) => ({
      type: "import_failure",
      title:
        payload.totalIssues > 0
          ? `${payload.totalIssues} product${payload.totalIssues === 1 ? "" : "s"} had issues during import`
          : "Some products had issues during import",
      message: `Download the error report to review product corrections ${ACTION_PLACEHOLDER}.`,
      resourceType: "import_job",
      resourceId: payload.jobId,
      actionUrl: "/passports",
      actionData: {
        kind: "download",
        label: "here",
        url: payload.correctionDownloadUrl ?? undefined,
        expiresAt: payload.correctionExpiresAt ?? undefined,
        filename: payload.correctionFilename ?? undefined,
        regenerate: {
          type: "import_corrections",
          jobId: payload.jobId,
        },
      },
      expiresInMs: NOTIFICATION_DEFAULT_EXPIRES_MS,
    }),
  },
  export_ready: {
    audience: "actor_only",
    resolve: (payload) => ({
      type: "export_ready",
      title: `${payload.productsExported} product${payload.productsExported === 1 ? "" : "s"} ${payload.productsExported === 1 ? "has" : "have"} been exported`,
      message: `Download the product export to review your exported products ${ACTION_PLACEHOLDER}.`,
      resourceType: "export_job",
      resourceId: payload.jobId,
      actionUrl: "/passports",
      actionData: {
        kind: "download",
        label: "here",
        url: payload.downloadUrl,
        expiresAt: payload.expiresAt,
        filename: payload.filename ?? undefined,
      },
      expiresInMs: NOTIFICATION_DEFAULT_EXPIRES_MS,
    }),
  },
  qr_export_ready: {
    audience: "actor_only",
    resolve: (payload) => ({
      type: "qr_export_ready",
      title: `${payload.exportedVariants} QR code${payload.exportedVariants === 1 ? "" : "s"} ${payload.exportedVariants === 1 ? "has" : "have"} been exported`,
      message: `Download the QR export to review your exported QR codes ${ACTION_PLACEHOLDER}.`,
      resourceType: "qr_export_job",
      resourceId: payload.jobId,
      actionUrl: "/passports",
      actionData: {
        kind: "download",
        label: "here",
        url: payload.downloadUrl,
        expiresAt: payload.expiresAt,
        filename: payload.filename ?? undefined,
      },
      expiresInMs: NOTIFICATION_DEFAULT_EXPIRES_MS,
    }),
  },
  invite_accepted: {
    audience: "brand_members_except_actor",
    resolve: (payload) => ({
      type: "invite_accepted",
      title: `${
        payload.acceptedUserName ||
        payload.acceptedUserEmail ||
        "A new member"
      } joined ${payload.brandName ?? "your brand"}`,
      message: `Your team has a new member. ${ACTION_PLACEHOLDER}`,
      resourceType: "brand_invite",
      resourceId: payload.inviteId,
      actionUrl: "/settings/members",
      actionData: {
        kind: "link",
        label: "view members",
        url: "/settings/members",
      },
      expiresInMs: NOTIFICATION_DEFAULT_EXPIRES_MS,
    }),
  },
};

export type PublishNotificationInput<K extends NotificationEventKey> = {
  event: K;
  brandId: string;
  payload: NotificationEventPayloadMap[K];
  actorUserId?: string | null;
};

export type NotificationInsertFromEvent = Omit<CreateNotificationParams, "userId">;
