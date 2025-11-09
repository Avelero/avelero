import "server-only";
import { Resend } from "resend";
import { env } from "../env.mjs";

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(env.RESEND_API_KEY);
  }
  return resendInstance;
}
