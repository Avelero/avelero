import React from "react";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";
import OtpEmail from "@v1/emails/otp.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string).replace(
  "v1,whsec_",
  "",
);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };

    const subject = `Your verification code: ${email_data.token}`;

    const { error } = await resend.emails.send({
      from: "Avelero <no-reply@welcome.avelero.com>",
      to: [user.email],
      subject,
      react: React.createElement(OtpEmail, {
        code: email_data.token,
        siteUrl: email_data.site_url,
        appName: "Avelero",
      }),
    });

    if (error) throw error;
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: {
          http_code: error?.code || 401,
          message: error?.message || "Unauthorized",
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  });
});