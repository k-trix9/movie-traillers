import { prisma } from "../lib/prisma.js";
import { nextBillingDate } from "./billing-rules.js";

function safeProviderRecord(transaction) {
  const record = {
    id: transaction.id,
    tx_ref: transaction.tx_ref,
    flw_ref: transaction.flw_ref,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    payment_type: transaction.payment_type,
    created_at: transaction.created_at
  };
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

export async function settleSuccessfulPayment(paymentId, transaction, eventType = "charge.completed") {
  // The callback and the webhook can arrive at the same moment. Serializable
  // transactions may then abort one of them (P2034); retrying is safe because
  // settlement is idempotent.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await settleOnce(paymentId, transaction, eventType);
    } catch (error) {
      if (error?.code === "P2034" && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      throw error;
    }
  }
}

async function settleOnce(paymentId, transaction, eventType) {
  const eventKey = `flutterwave:${transaction.id}:${transaction.status}`;
  const safeRecord = safeProviderRecord(transaction);

  try {
    return await prisma.$transaction(async (tx) => {
      const priorEvent = await tx.paymentEvent.findUnique({ where: { eventKey } });
      if (priorEvent) return { alreadyProcessed: true };

      await tx.paymentEvent.create({
        data: {
          provider: "flutterwave",
          eventKey,
          eventType,
          providerTransactionId: String(transaction.id),
          payload: safeRecord
        }
      });

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { planPrice: { include: { plan: true } } }
      });

      if (!payment) throw new Error("Payment record was not found.");
      if (payment.status === "SUCCESSFUL") return { alreadyProcessed: true };

      const now = new Date();
      const activeSubscription = await tx.subscription.findFirst({
        where: {
          userId: payment.userId,
          status: "ACTIVE",
          currentPeriodEnd: { gt: now }
        },
        orderBy: { currentPeriodEnd: "desc" }
      });

      let subscription;
      if (activeSubscription) {
        if (activeSubscription.planPriceId !== payment.planPriceId) {
          throw new Error("An active subscription exists on a different plan. Resolve the plan change before settling.");
        }

        const nextEnd = nextBillingDate(
          activeSubscription.currentPeriodEnd,
          payment.planPrice.intervalMonths,
          now
        );

        subscription = await tx.subscription.update({
          where: { id: activeSubscription.id },
          data: {
            currentPeriodEnd: nextEnd,
            cancelAtPeriodEnd: false,
            cancelledAt: null
          }
        });
      } else {
        const end = nextBillingDate(null, payment.planPrice.intervalMonths, now);

        subscription = await tx.subscription.create({
          data: {
            userId: payment.userId,
            planId: payment.planPrice.planId,
            planPriceId: payment.planPriceId,
            status: "ACTIVE",
            provider: "flutterwave",
            startsAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: end
          }
        });
      }

      const providerPaidAt = transaction.created_at ? new Date(transaction.created_at) : now;
      const paidAt = Number.isNaN(providerPaidAt.getTime()) ? now : providerPaidAt;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          subscriptionId: subscription.id,
          providerTransactionId: String(transaction.id),
          status: "SUCCESSFUL",
          paidAt,
          rawProviderData: safeRecord
        }
      });

      return { alreadyProcessed: false, subscriptionId: subscription.id };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const target = error.meta?.target;
    const isEventKeyConflict =
      error.code === "P2002" &&
      (String(target).includes("eventKey") || (Array.isArray(target) && target.includes("eventKey")));
    if (isEventKeyConflict) return { alreadyProcessed: true };
    throw error;
  }
}

export async function markPaymentFailed(paymentId, status = "FAILED") {
  return prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status }
  });
}
