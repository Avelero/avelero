/**
 * Thin contract test for checkout.session.completed using a captured real event payload.
 *
 * The fixture is intentionally optional because hosted Checkout completion is
 * not fully automatable. When a captured sandbox payload is present, this test
 * replays its real shape while swapping in live brand and subscription IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "bun:test";
import type Stripe from "stripe";
import { handleCheckoutCompleted } from "../../src/lib/stripe/handlers/checkout-completed";
import {
  ensureLiveStripePriceCatalog,
  provisionActiveStripeBillingBrand,
  readLiveBrandBillingState,
} from "./helpers/live-billing";

const FIXTURE_PATH = resolve(
  import.meta.dir,
  "../fixtures/stripe/checkout-session-completed.real.json",
);

/**
 * Loads the captured Checkout event fixture when it is available locally.
 */
function loadCapturedCheckoutFixture(): Stripe.Event | null {
  if (!existsSync(FIXTURE_PATH)) {
    return null;
  }

  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Stripe.Event;
}

beforeAll(async () => {
  // Validate the sandbox price catalog before replaying a captured Checkout event.
  await ensureLiveStripePriceCatalog();
});

const fixture = loadCapturedCheckoutFixture();
const liveDescribe = fixture ? describe : describe.skip;

liveDescribe("checkout.session.completed contract", () => {
  it("replays a captured Checkout payload shape against a live subscription", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Checkout Contract",
      tier: "growth",
      interval: "monthly",
      includeImpact: true,
    });

    try {
      const event = structuredClone(fixture!) as Stripe.Event;
      const session = event.data.object as Stripe.Checkout.Session;

      session.metadata = {
        ...(session.metadata ?? {}),
        brand_id: provisioned.harness.brandId,
        plan_type: "growth",
        billing_interval: "monthly",
        include_impact: "true",
      };
      session.customer = provisioned.customer.id;
      session.subscription = provisioned.subscription.id;

      await handleCheckoutCompleted(event);

      const state = await readLiveBrandBillingState(provisioned.harness.brandId);
      expect(state.lifecycle?.phase).toBe("active");
      expect(state.plan?.planType).toBe("growth");
      expect(state.plan?.billingInterval).toBe("monthly");
      expect(state.plan?.hasImpactPredictions).toBe(true);
      expect(state.billing?.stripeSubscriptionId).toBe(provisioned.subscription.id);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
