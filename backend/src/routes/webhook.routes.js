import { prisma } from "../lib/prisma.js";
import { isValidFlutterwaveWebhook, verifyFlutterwaveTransaction } from "../services/flutterwave.service.js";
import { markPaymentFailed, settleSuccessfulPayment } from "../services/payment-settlement.service.js";

export async function flutterwaveWebhook(req, res) {
  const rawBody = req.body;

  if (!isValidFlutterwaveWebhook(rawBody, req.headers)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  const data = payload?.data;
  if (!data?.tx_ref) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { reference: String(data.tx_ref) }
    });

    if (!payment) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (data.status === "successful" && data.id) {
      const transaction = await verifyFlutterwaveTransaction(String(data.id), payment);
      await settleSuccessfulPayment(payment.id, transaction, payload.event || "charge.completed");
    } else if (["failed", "cancelled"].includes(data.status)) {
      await markPaymentFailed(payment.id, data.status === "cancelled" ? "CANCELLED" : "FAILED");
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Flutterwave webhook processing failed:", error);
    return res.status(500).json({ error: "Webhook processing failed. The provider may retry." });
  }
}
