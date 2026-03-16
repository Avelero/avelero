/**
 * Webhook handler registry.
 *
 * Importing this module registers all Stripe webhook event handlers
 * with the central dispatcher in `webhook-handler.ts`.
 */
import { registerWebhookHandler } from "../webhook-handler.js";
import { handleCheckoutCompleted } from "./checkout-completed.js";
import {
  handleInvoiceCreated,
  handleInvoiceFinalized,
  handleInvoiceMarkedUncollectible,
  handleInvoiceUpdated,
  handleInvoiceVoided,
} from "./invoice-projection.js";
import { handleInvoiceOverdue } from "./invoice-overdue.js";
import { handleInvoicePaid } from "./invoice-paid.js";
import { handleInvoicePaymentFailed } from "./invoice-payment-failed.js";
import { handleSubscriptionDeleted } from "./subscription-deleted.js";
import { handleSubscriptionUpdated } from "./subscription-updated.js";

registerWebhookHandler("checkout.session.completed", handleCheckoutCompleted);
registerWebhookHandler("invoice.created", handleInvoiceCreated);
registerWebhookHandler("invoice.finalized", handleInvoiceFinalized);
registerWebhookHandler("invoice.updated", handleInvoiceUpdated);
registerWebhookHandler("invoice.overdue", handleInvoiceOverdue);
registerWebhookHandler("invoice.paid", handleInvoicePaid);
registerWebhookHandler("invoice.payment_failed", handleInvoicePaymentFailed);
registerWebhookHandler("invoice.voided", handleInvoiceVoided);
registerWebhookHandler(
  "invoice.marked_uncollectible",
  handleInvoiceMarkedUncollectible,
);
registerWebhookHandler(
  "customer.subscription.updated",
  handleSubscriptionUpdated,
);
registerWebhookHandler(
  "customer.subscription.deleted",
  handleSubscriptionDeleted,
);
