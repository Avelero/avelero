import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandAccessGateView } from "./brand-access-gate";

const baseBrandAccess = {
  decision: {
    code: "allowed",
    allowed: true,
    reason: null,
    brandId: "brand-1",
    planType: "starter",
    billingStatus: "active",
    qualificationStatus: "qualified",
    operationalStatus: "active",
  },
  controlSnapshot: {
    planType: "starter",
    planCurrency: "EUR",
    customMonthlyPriceCents: null,
    billingStatus: "active",
    billingMode: "standard_checkout",
    qualificationStatus: "qualified",
    operationalStatus: "active",
    billingAccessOverride: "none",
  },
};

function renderGate(props) {
  return renderToStaticMarkup(
    createElement(
      BrandAccessGateView,
      props,
      createElement("div", { "data-testid": "content" }, "Core content"),
    ),
  );
}

describe("BrandAccessGateView", () => {
  it("shows forced billing modal on blocked routes for billing-blocked decisions", () => {
    const html = renderGate({
      pathname: "/passports",
      brandAccess: {
        ...baseBrandAccess,
        decision: {
          ...baseBrandAccess.decision,
          code: "blocked_pending_payment",
          allowed: false,
          billingStatus: "pending_payment",
        },
        controlSnapshot: {
          ...baseBrandAccess.controlSnapshot,
          billingStatus: "pending_payment",
        },
      },
    });

    expect(html).toContain('data-testid="billing-blocked-modal"');
    expect(html).toContain("Payment link coming soon");
  });

  it("shows non-billing block screen on blocked routes for non-billing decisions", () => {
    const html = renderGate({
      pathname: "/passports",
      brandAccess: {
        ...baseBrandAccess,
        decision: {
          ...baseBrandAccess.decision,
          code: "blocked_suspended",
          allowed: false,
          operationalStatus: "suspended",
        },
      },
    });

    expect(html).toContain('data-testid="non-billing-block-screen"');
    expect(html).toContain("Access unavailable");
  });

  it("does not show overlays on allowed blocked routes", () => {
    const html = renderGate({
      pathname: "/settings",
      brandAccess: {
        ...baseBrandAccess,
        decision: {
          ...baseBrandAccess.decision,
          code: "blocked_pending_payment",
          allowed: false,
          billingStatus: "pending_payment",
        },
      },
    });

    expect(html).toContain('data-testid="content"');
    expect(html).not.toContain('data-testid="billing-blocked-modal"');
    expect(html).not.toContain('data-testid="non-billing-block-screen"');
  });
});
