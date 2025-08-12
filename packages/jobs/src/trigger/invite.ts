import { logger, task } from "@trigger.dev/sdk/v3";
import { render } from "@react-email/render";
import InviteEmail from "@v1/email/emails/invite";
import { resend } from "../utils/resend";

type InvitePayload = {
  invites: Array<{
    recipientEmail: string;
    brandName: string;
    role: "owner" | "member";
    acceptUrl: string;
    expiresAt?: string | null;
    appName?: string;
  }>;
  from?: string;
};

export const inviteBrandMembers = task({
  id: "invite-brand-members",
  run: async (payload: InvitePayload) => {
    const from = payload.from ?? "Avelero <no-reply@welcome.avelero.com>";

    const jobs = payload.invites.map(async (invite) => {
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

      const res = await resend.emails.send({
        from,
        to: [invite.recipientEmail],
        subject: `Invitation to join ${invite.brandName}`,
        html,
      });
      logger.log("invite email sent", { to: invite.recipientEmail, id: res.data?.id, error: res.error });
    });

    await Promise.all(jobs);
  },
});


