import { app, pool } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`FILMORA is running at http://localhost:${env.PORT}`);
});

async function shutdown() {
  console.log("Shutting down FILMORA...");
  server.close(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
