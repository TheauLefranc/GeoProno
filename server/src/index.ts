import { createApp } from "./app";
import { config } from "./lib/config";
import { prisma } from "./lib/db";
import { scheduleDailyRefill } from "./services/refill";

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`GeoProno API sur :${config.port}`);
  scheduleDailyRefill();
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
