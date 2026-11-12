import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const plans = await prisma.plan.findMany({
    include: {
      prices: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.table(plans.map(plan => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    active: plan.isActive,
    existingPrices: plan.prices.map(p =>
      `${p.currency} ${p.amount} (${p.intervalMonths} month)`
    ).join(", ")
  })));
} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
