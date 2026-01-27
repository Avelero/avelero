"use client";

import { Header } from "@/components/header";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, ShoppingBag } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Connect Shopify Page
 *
 * This page handles claiming a pending Shopify installation.
 * Users land here after installing from the Shopify App Store.
 *
 * URL: /connect/shopify?shop=xxx.myshopify.com
 *
 * Flow:
 * 1. Extract shop domain from URL
 * 2. Auto-call claimInstallation mutation
 * 3. On success: redirect to /settings/integrations/shopify
 * 4. On error: display error message
 */
export default function ConnectShopifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trpc = useTRPC();
  const shop = searchParams.get("shop");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const claimMutation = useMutation(
    trpc.integrations.connections.claimInstallation.mutationOptions({
      onSuccess: () => {
        setStatus("success");
        // Redirect after a brief delay to show success state
        setTimeout(() => {
          router.push("/settings/integrations/shopify");
        }, 1500);
      },
      onError: (err) => {
        setStatus("error");
        setErrorMessage(err.message);
      },
    }),
  );

  useEffect(() => {
    if (
      shop &&
      !claimMutation.isPending &&
      !claimMutation.isSuccess &&
      !claimMutation.isError
    ) {
      claimMutation.mutate({ shopDomain: shop });
    }
  }, [shop, claimMutation.isPending, claimMutation.isSuccess, claimMutation.isError]);

  // No shop parameter in URL
  if (!shop) {
    return (
      <div className="h-full w-full">
        <Header />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-primary">
              Missing Shop Parameter
            </h1>
            <p className="text-secondary">
              No Shopify store was specified. Please try installing the app
              again from the Shopify App Store or from your Avelero dashboard.
            </p>
            <button
              type="button"
              onClick={() => router.push("/settings/integrations")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Integrations
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Header />
      <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold text-primary">
                Connecting Your Shopify Store
              </h1>
              <p className="text-secondary">
                Setting up the connection for <strong>{shop}</strong>...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-primary mt-4" />
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold text-primary">
                Successfully Connected!
              </h1>
              <p className="text-secondary">
                Your Shopify store <strong>{shop}</strong> is now connected to
                Avelero. Redirecting to your integration settings...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-primary mt-4" />
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-primary">
                Connection Failed
              </h1>
              <p className="text-secondary">
                We couldn&apos;t connect your Shopify store. {errorMessage}
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("loading");
                    setErrorMessage(null);
                    claimMutation.mutate({ shopDomain: shop });
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/settings/integrations")}
                  className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent transition-colors"
                >
                  Go to Integrations
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
