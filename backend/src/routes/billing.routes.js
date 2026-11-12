import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createHostedCheckout,
  verifyFlutterwaveTransaction
} from "../services/flutterwave.service.js";
import {
  markPaymentFailed,
  settleSuccessfulPayment
} from "../services/payment-settlement.service.js";

const router = Router();

router.get("/plans", asyncHandler(async (req, res) => {
  const currency = String(req.query.currency || env.DEFAULT_CURRENCY).toUpperCase();
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    include: {
      prices: { where: { currency, isActive: true }, take: 1 }
    },
    orderBy: { createdAt: "asc" }
  });

  res.json({
    devPaymentBypass: env.DEV_PAYMENT_BYPASS,
    plans: plans
      .filter((plan) => plan.prices.length > 0)
      .map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        maxScreens: plan.maxScreens,
        maxResolution: plan.maxResolution,
        price: {
          id: plan.prices[0].id,
          amount: Number(plan.prices[0].amount),
          currency: plan.prices[0].currency,
          intervalMonths: plan.prices[0].intervalMonths
        }
      }))
  });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId: req.user.id },
    include: { plan: true, planPrice: true },
    orderBy: { currentPeriodEnd: "desc" }
  });

  const isActive = Boolean(
    subscription &&
    subscription.status === "ACTIVE" &&
    subscription.currentPeriodEnd > new Date()
  );

  res.json({
    subscription: subscription ? {
      id: subscription.id,
      status: isActive ? "ACTIVE" : (subscription.currentPeriodEnd <= new Date() ? "EXPIRED" : subscription.status),
      plan: subscription.plan.name,
      amount: Number(subscription.planPrice.amount),
      currency: subscription.planPrice.currency,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    } : null,
    hasAccess: isActive
  });
}));

router.post("/checkout", requireAuth, asyncHandler(async (req, res) => {
  const input = z.object({ planPriceId: z.string().uuid() }).parse(req.body);

  if (!process.env.FLW_SECRET_KEY) {
    throw new HttpError(503, "Payment checkout is not configured. Add your Flutterwave secret key to backend/.env.");
  }

  const price = await prisma.planPrice.findFirst({
    where: { id: input.planPriceId, isActive: true },
    include: { plan: true }
  });
  if (!price || !price.plan.isActive) throw new HttpError(404, "This subscription plan is unavailable.");

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId: req.user.id,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() }
    },
    orderBy: { currentPeriodEnd: "desc" }
  });

  if (activeSubscription && activeSubscription.planPriceId !== price.id) {
    throw new HttpError(409, "You already have an active plan. You can renew the same plan or change plans after it expires.");
  }

  const reference = `FILMORA-${randomUUID()}`;
  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      planPriceId: price.id,
      provider: "flutterwave",
      reference,
      amount: price.amount,
      currency: price.currency,
      status: "PENDING"
    }
  });

  try {
    const checkoutUrl = await createHostedCheckout({
      payment,
      user: req.user,
      plan: price.plan
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl }
    });

    res.status(201).json({ checkoutUrl, reference });
  } catch (error) {
    await markPaymentFailed(payment.id, "FAILED");
    throw error;
  }
}));

router.get("/flutterwave/callback", asyncHandler(async (req, res) => {
  const reference = typeof req.query.tx_ref === "string" ? req.query.tx_ref : "";
  const transactionId = typeof req.query.transaction_id === "string" ? req.query.transaction_id : "";
  const providerStatus = typeof req.query.status === "string" ? req.query.status : "";

  try {
    if (providerStatus === "successful" && reference && transactionId) {
      const payment = await prisma.payment.findUnique({ where: { reference } });
      if (payment) {
        const transaction = await verifyFlutterwaveTransaction(transactionId, payment);
        await settleSuccessfulPayment(payment.id, transaction, "callback");
        return res.redirect("/payment-result?result=success");
      }
    }

    if (reference && ["failed", "cancelled"].includes(providerStatus)) {
      const payment = await prisma.payment.findUnique({ where: { reference } });
      if (payment) {
        await markPaymentFailed(payment.id, providerStatus === "cancelled" ? "CANCELLED" : "FAILED");
      }
      return res.redirect("/payment-result?result=failed");
    }
  } catch (error) {
    // The webhook may still settle the payment, so show "pending" rather than a raw error.
    console.error("Flutterwave callback verification failed:", error.message);
    return res.redirect("/payment-result?result=pending");
  }

  return res.redirect("/payment-result?result=pending");
}));

router.get("/payments", requireAuth, asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    include: { planPrice: { include: { plan: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 24
  });
  res.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      plan: payment.planPrice.plan.name,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt
    }))
  });
}));

// Local testing helper. env.js forces this off unless NODE_ENV=development AND
// DEV_PAYMENT_BYPASS=true, so it cannot run on a production server.
router.post("/dev-activate", requireAuth, asyncHandler(async (req, res) => {
  if (!env.DEV_PAYMENT_BYPASS) throw new HttpError(404, "API route not found.");
  const input = z.object({ planPriceId: z.string().uuid() }).parse(req.body);
  const price = await prisma.planPrice.findFirst({
    where: { id: input.planPriceId, isActive: true },
    include: { plan: true }
  });
  if (!price) throw new HttpError(404, "This subscription plan is unavailable.");

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      planPriceId: price.id,
      provider: "dev-bypass",
      reference: `DEV-${randomUUID()}`,
      amount: price.amount,
      currency: price.currency,
      status: "PENDING"
    }
  });
  await settleSuccessfulPayment(payment.id, {
    id: `dev-${randomUUID()}`,
    status: "successful",
    tx_ref: payment.reference,
    amount: Number(price.amount),
    currency: price.currency,
    payment_type: "dev-bypass"
  }, "dev.activate");
  res.status(201).json({ activated: true });
}));

router.post("/cancel", requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: req.user.id,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() }
    },
    orderBy: { currentPeriodEnd: "desc" }
  });

  if (!subscription) throw new HttpError(404, "There is no active subscription to cancel.");

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, cancelledAt: new Date() }
  });

  res.json({
    message: "Your plan will remain active until the end of the paid period. It will not renew automatically in this starter version.",
    currentPeriodEnd: updated.currentPeriodEnd
  });
}));

export default router;
