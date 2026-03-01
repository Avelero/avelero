import {
  INVITE_REQUIRED_LOGIN_PATH,
  getForceSignOutPath,
} from "@/lib/auth-access";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Redirecting | Avelero",
};

export default function Page() {
  redirect(getForceSignOutPath(INVITE_REQUIRED_LOGIN_PATH));
}
