/**
 * Send QR Export Ready Email
 *
 * Sends an email notification with the signed CSV download URL after
 * a QR export job has completed.
 */

import "../configure-trigger";
import { render } from "@react-email/render";
import { logger, task } from "@trigger.dev/sdk/v3";
import QrExportReadyEmail from "@v1/email/emails/qr-export-ready";
import { getResend } from "../../utils/resend";

interface SendQrExportReadyEmailPayload {
  jobId: string;
  brandId: string;
  userEmail: string;
  downloadUrl: string;
  expiresAt: string;
  exportedVariants: number;
}

const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

export const sendQrExportReadyEmail = task({
  id: "send-qr-export-ready-email",
  maxDuration: 300,
  retry: { maxAttempts: 3 },

  run: async (payload: SendQrExportReadyEmailPayload) => {
    const html = await render(
      QrExportReadyEmail({
        exportedVariants: payload.exportedVariants,
        downloadUrl: payload.downloadUrl,
        expiresAt: payload.expiresAt,
      }),
    );

    const resend = getResend();
    await resend.emails.send({
      from: EMAIL_FROM,
      to: [payload.userEmail],
      subject: "Your QR code export is ready",
      html,
    });

    logger.info("QR export ready email sent", {
      jobId: payload.jobId,
      brandId: payload.brandId,
      userEmail: payload.userEmail,
    });
  },
});
