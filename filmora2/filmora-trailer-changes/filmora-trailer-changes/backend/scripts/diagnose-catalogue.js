// READ-ONLY. Explains why each movie is (or is not) in the public catalogue.
//   node scripts/diagnose-catalogue.js
// It does not change anything and does not bypass any licence rule.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

try {
  const movies = await prisma.movie.findMany({
    include: { licenses: true, videoAssets: true, media: true },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Movies in database: ${movies.length}`);
  console.log(`TRUST_CF_IP_COUNTRY = ${env.TRUST_CF_IP_COUNTRY} ` +
    "(when false, only WORLDWIDE licences can appear in the public list)\n");

  const now = new Date();
  let visible = 0;

  for (const movie of movies) {
    const problems = [];

    if (movie.publicationStatus !== "PUBLISHED") {
      problems.push(`status is ${movie.publicationStatus}, not PUBLISHED`);
    }

    const goodLicense = movie.licenses.some((l) =>
      l.status === "VERIFIED" &&
      l.permittedDistribution &&
      l.validFrom <= now &&
      (!l.validUntil || l.validUntil >= now) &&
      (env.TRUST_CF_IP_COUNTRY ? true : l.territory === "WORLDWIDE")
    );

    if (!movie.licenses.length) {
      problems.push("no licence record");
    } else if (!goodLicense) {
      problems.push("no verified, in-date licence usable for visitors: " +
        movie.licenses.map((l) =>
          `[${l.territory} ${l.status} distribution=${l.permittedDistribution} ` +
          `from ${l.validFrom.toISOString().slice(0, 10)}` +
          `${l.validUntil ? ` until ${l.validUntil.toISOString().slice(0, 10)}` : ""}]`
        ).join(" "));
    }

    const trailer = movie.media.find((m) => m.mediaType === "trailer" && m.fileUrl);
    if (!problems.length) visible += 1;

    console.log(`${problems.length ? "HIDDEN " : "VISIBLE"}  ${movie.title}` +
      `  | trailer: ${trailer ? "yes" : "no"}`);
    problems.forEach((p) => console.log(`           - ${p}`));
  }

  console.log(`\nVisible in public catalogue: ${visible} of ${movies.length}`);
  if (!movies.length) {
    console.log("The database has no movies. The seed script only creates roles, plans and the admin user.");
  }
} finally {
  await prisma.$disconnect();
}
