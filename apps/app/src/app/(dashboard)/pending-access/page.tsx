import { DeleteAccount } from "@/components/account/delete-account";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Header } from "@/components/header";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { Button } from "@v1/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pending access | Avelero",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const invites = await queryClient.fetchQuery(
    trpc.user.invites.list.queryOptions(),
  );

  const hasInvites = invites.length > 0;
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  const hasSupportEmail = supportEmail.length > 0;

  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center overflow-y-auto scrollbar-hide px-4">
          <div className="w-full max-w-[700px] space-y-6">
            <div className="border p-6 space-y-4">
              <div className="space-y-2">
                <h6 className="text-foreground">
                  You are signed in, but access is pending
                </h6>
                <p className="text-secondary">
                  Your account does not currently belong to any brand
                  workspace. Access is granted through brand invitations.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-secondary">
                  {hasInvites
                    ? "You have pending invitations. Open invites and accept with the invited email account."
                    : "No active invitations were found for this account."}
                </p>
                <p className="text-secondary">
                  {hasSupportEmail
                    ? `Need a new invite? Contact the founders at ${supportEmail}.`
                    : "Need a new invite? Contact your brand owner or Avelero founders."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {hasInvites ? (
                  <Button asChild>
                    <Link href="/invites" prefetch>
                      Check invites
                    </Link>
                  </Button>
                ) : null}
                {hasSupportEmail ? (
                  <Button asChild variant="outline">
                    <a href={`mailto:${supportEmail}`}>Contact founders</a>
                  </Button>
                ) : null}
                <SignOutButton variant="outline" />
              </div>
            </div>

            <DeleteAccount />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
