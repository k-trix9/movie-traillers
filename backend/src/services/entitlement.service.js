import { prisma } from "../lib/prisma.js";
import { licenseCoversTerritory } from "./license-rules.js";

export async function userHasActiveSubscription(userId) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() }
    },
    include: { plan: { select: { maxScreens: true } } }
  });
}

export async function movieHasValidLicense(movieId, countryCode = null) {
  const licenses = await prisma.contentLicense.findMany({
    where: { movieId },
    select: {
      territory: true,
      status: true,
      permittedDistribution: true,
      validFrom: true,
      validUntil: true
    }
  });
  return licenseCoversTerritory(licenses, countryCode);
}
