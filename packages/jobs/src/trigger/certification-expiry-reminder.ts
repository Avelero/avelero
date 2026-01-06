import { render } from "@react-email/render";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import CertificationExpiryReminder from "@v1/email/emails/certification-expiry-reminder";
import type { Database } from "@v1/supabase/types";
import { getResend } from "../utils/resend";

/**
 * Certification Expiry Reminder Job
 *
 * Runs daily at 08:00 UTC to check for certifications expiring at specific intervals
 * and sends reminder emails to the brand's configured email address.
 *
 * Reminder intervals: 30 days, 14 days, 7 days, 1 day before expiry
 */
export const certificationExpiryReminder = schedules.task({
  id: "certification-expiry-reminder",
  // Daily at 08:00 UTC (reasonable time for business hours globally)
  cron: "0 8 * * *",
  run: async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY as string | undefined;

    if (!url || !serviceKey) {
      logger.error("Supabase env vars missing for certification expiry check", {
        hasUrl: !!url,
        hasKey: !!serviceKey,
      });
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createSupabaseClient<Database>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Reminder intervals in days
    const reminderIntervals = [30, 14, 7, 1];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let totalEmailsSent = 0;
    let totalErrors = 0;

    for (const daysUntilExpiry of reminderIntervals) {
      // Calculate the target expiry date for this interval
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntilExpiry);
      const targetDateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

      logger.info(
        `Checking for certifications expiring in ${daysUntilExpiry} days`,
        {
          targetDate: targetDateStr,
        },
      );

      // Query certifications expiring on the target date
      // Join with brands to get brand name and email
      const { data: expiringCerts, error: queryError } = await supabase
        .from("brand_certifications")
        .select(
          `
          id,
          title,
          certification_code,
          expiry_date,
          brands!inner (
            id,
            name,
            slug,
            email
          )
        `,
        )
        .not("expiry_date", "is", null)
        .gte("expiry_date", `${targetDateStr}T00:00:00.000Z`)
        .lt("expiry_date", `${targetDateStr}T23:59:59.999Z`);

      if (queryError) {
        logger.error("Failed to query expiring certifications", {
          error: queryError.message,
          daysUntilExpiry,
        });
        totalErrors++;
        continue;
      }

      if (!expiringCerts || expiringCerts.length === 0) {
        logger.info(`No certifications expiring in ${daysUntilExpiry} days`);
        continue;
      }

      logger.info(
        `Found ${expiringCerts.length} certifications expiring in ${daysUntilExpiry} days`,
      );

      // Send reminder emails for each expiring certification
      for (const cert of expiringCerts) {
        const brand = cert.brands as unknown as {
          id: string;
          name: string;
          slug: string | null;
          email: string | null;
        };

        // Skip if brand has no email configured
        if (!brand.email) {
          logger.warn(
            "Skipping certification - brand has no email configured",
            {
              certificationId: cert.id,
              certificationTitle: cert.title,
              brandId: brand.id,
              brandName: brand.name,
            },
          );
          continue;
        }

        try {
          // Construct the update URL
          // TODO: Update this once certifications management page is available
          const baseUrl =
            process.env.API_URL?.replace("/api", "") ||
            "https://app.avelero.com";
          const updateUrl = `${baseUrl}/settings`;

          // Render the email template
          const html = await render(
            CertificationExpiryReminder({
              brandEmail: brand.email,
              brandName: brand.name,
              certificationTitle: cert.title,
              certificationCode: cert.certification_code ?? undefined,
              expiryDate: cert.expiry_date!,
              daysUntilExpiry,
              updateUrl,
              appName: "Avelero",
            }),
          );

          // Send the email via Resend
          const resend = getResend();
          const res = await resend.emails.send({
            from: "Avelero <no-reply@welcome.avelero.com>",
            to: [brand.email],
            subject: `Certification Expiring: ${cert.title} expires in ${daysUntilExpiry === 1 ? "1 day" : `${daysUntilExpiry} days`}`,
            html,
          });

          if (res.error) {
            logger.error("Failed to send certification expiry reminder", {
              certificationId: cert.id,
              certificationTitle: cert.title,
              brandEmail: brand.email,
              error: res.error,
            });
            totalErrors++;
          } else {
            logger.info("Certification expiry reminder sent successfully", {
              certificationId: cert.id,
              certificationTitle: cert.title,
              brandEmail: brand.email,
              daysUntilExpiry,
              emailId: res.data?.id,
            });
            totalEmailsSent++;
          }
        } catch (error) {
          logger.error(
            "Exception while sending certification expiry reminder",
            {
              certificationId: cert.id,
              certificationTitle: cert.title,
              brandEmail: brand.email,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          totalErrors++;
        }
      }
    }

    logger.log("Certification expiry reminder job completed", {
      totalEmailsSent,
      totalErrors,
      reminderIntervals,
    });

    return {
      emailsSent: totalEmailsSent,
      errors: totalErrors,
    };
  },
});
