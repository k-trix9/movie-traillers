import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const prices = await prisma.planPrice.findMany({
    include: {
      plan: {
        select: { name: true, isActive: true }
      }
    },
    orderBy: [
      { currency: "asc" },
      { amount: "asc" }
    ]
  });

  console.table(prices.map(p => ({
    plan: p.plan.name,
    planActive: p.plan.isActive,
    currency: p.currency,
    amount: Number(p.amount),
    priceActive: p.isActive
  })));
} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
