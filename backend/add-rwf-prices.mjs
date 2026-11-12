import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pricing = [
  { code: "BASIC", amount: "2000.00" },
  { code: "STANDARD", amount: "3500.00" },
  { code: "FAMILY", amount: "5000.00" }
];

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const item of pricing) {
      const plan = await tx.plan.findUnique({
        where: { code: item.code }
      });

      if (!plan || !plan.isActive) {
        throw new Error(`Plan ${item.code} is missing or inactive.`);
      }

      const existing = await tx.planPrice.findUnique({
        where: {
          planId_currency_intervalMonths: {
            planId: plan.id,
            currency: "RWF",
            intervalMonths: 1
          }
        }
      });

      if (existing) {
        throw new Error(
          `An RWF price already exists for ${item.code}. No changes made.`
        );
      }

      await tx.planPrice.create({
        data: {
          planId: plan.id,
          currency: "RWF",
          amount: item.amount,
          intervalMonths: 1,
          isActive: true
        }
      });

      console.log(`Prepared ${item.code}: ${item.amount} RWF`);
    }
  });

  console.log("\nAll three RWF prices were created successfully.");
}

try {
  await main();
} catch (error) {
  console.error("\nRWF pricing update failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
