import { render } from "@react-email/render";
import "./configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import InviteEmail from "@v1/email/emails/invite";
import { getResend } from "../utils/resend";

type InvitePayload = {
  invites: Array<{
    recipientEmail: string;
    brandName: string;
    role: "owner" | "member";
    acceptUrl: string;
    expiresAt?: string | null;
    appName?: string;
    ctaMode?: "accept" | "view";
  }>;
  from?: string;
};

export const inviteBrandMembers = task({
  id: "invite-brand-members",
  run: async (payload: InvitePayload) => {
    logger.info("Starting invite-brand-members task", {
      inviteCount: payload.invites.length,
    });

    const from = payload.from ?? "Avelero <no-reply@welcome.avelero.com>";

    const jobs = payload.invites.map(async (invite) => {
      try {
        logger.info("Rendering email for invite", {
          recipient: invite.recipientEmail,
          brandName: invite.brandName,
        });

        const html = await render(
          InviteEmail({
            recipientEmail: invite.recipientEmail,
            brandName: invite.brandName,
            role: invite.role,
            acceptUrl: invite.acceptUrl,
            expiresAt: invite.expiresAt ?? undefined,
            appName: invite.appName ?? "Avelero",
          }),
        );

        const resend = getResend();
        logger.info("Sending email via Resend", {
          to: invite.recipientEmail,
          from,
        });

        const res = await resend.emails.send({
          from,
          to: [invite.recipientEmail],
          subject: `Invitation to join ${invite.brandName}`,
          html,
        });

        if (res.error) {
          logger.error("Failed to send invite email", {
            to: invite.recipientEmail,
            error: res.error,
          });
        } else {
          logger.info("Invite email sent successfully", {
            to: invite.recipientEmail,
            id: res.data?.id,
          });
        }
      } catch (error) {
        logger.error("Exception while sending invite email", {
          to: invite.recipientEmail,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    await Promise.all(jobs);

    logger.info("Completed invite-brand-members task", {
      inviteCount: payload.invites.length,
    });
  },
});
