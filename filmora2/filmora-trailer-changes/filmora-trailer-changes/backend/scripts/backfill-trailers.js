// Adds missing TMDB trailers to existing movies.
//   node scripts/backfill-trailers.js --dry-run   (only shows what would happen)
//   node scripts/backfill-trailers.js             (does the work)
// It only creates/updates "trailer" rows in MovieMedia. Nothing is deleted.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { backfillMissingTrailers } from "../src/services/trailer.service.js";

const dryRun = process.argv.includes("--dry-run");

try {
  const summary = await backfillMissingTrailers(prisma, {
    dryRun,
    log: (line) => console.log(line)
  });
  console.log("\nSummary:", summary);
} finally {
  await prisma.$disconnect();
}
