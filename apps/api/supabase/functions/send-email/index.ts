import { renderAsync } from "@react-email/components";
import React from "react";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";
import OtpEmail from "./_templates/otp.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const rawHookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
if (!rawHookSecret) {
  throw new Error("SEND_EMAIL_HOOK_SECRET environment variable is not set");
}
const hookSecret = rawHookSecret.replace("v1,whsec_", "");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);
  try {
    const {
      user,
      email_data: {
        token,
        token_hash,
        redirect_to,
        email_action_type,
        site_url,
        token_new,
        token_hash_new,
      },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
      };
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

    const html = await renderAsync(
      React.createElement(OtpEmail, {
        code: token,
        siteUrl: site_url,
        appName: "Avelero",
      }),
    );

    const { error } = await resend.emails.send({
      from: "Avelero <no-reply@welcome.avelero.com>",
      to: [user.email],
      subject: `Your verification code: ${token}`,
      html,
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.log(error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: (error as any).code,
          message: (error as any).message,
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
