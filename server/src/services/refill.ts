import cron from "node-cron";
import { config } from "../lib/config";
import { prisma } from "../lib/db";
import { localDateParts } from "./payout";
import { getSettings } from "./settings";

/**
 * Tops every account below the threshold back up to it, once per local day.
 * Idempotent: the day is recorded in settings, so restarts or multiple runs are safe.
 */
export async function runDailyRefill(now = new Date(), force = false): Promise<number> {
  const settings = await getSettings();
  const { day, hour } = localDateParts(now, config.timezone);
  if (!force && (settings.lastRefillDate === day || hour < settings.refillHour)) return 0;

  return prisma.$transaction(async (tx) => {
    // Claim the day first so a concurrent run does nothing.
    const claimed = await tx.appSettings.updateMany({
      where: force ? { id: 1 } : { id: 1, OR: [{ lastRefillDate: null }, { lastRefillDate: { not: day } }] },
      data: { lastRefillDate: day },
    });
    if (claimed.count === 0) return 0;

    const threshold = settings.refillThreshold;
    const users = await tx.user.findMany({ where: { balance: { lt: threshold } }, select: { id: true, balance: true } });
    for (const u of users) {
      await tx.user.update({ where: { id: u.id }, data: { balance: threshold } });
      await tx.transaction.create({
        data: {
          userId: u.id,
          type: "DAILY_REFILL",
          amount: threshold - u.balance,
          balanceAfter: threshold,
          note: `Recharge du ${day}`,
        },
      });
    }
    return users.length;
  });
}

export function scheduleDailyRefill() {
  // Checked every 5 minutes: fires on the first tick after the configured hour,
  // and catches up after downtime. The hour stays editable from the admin page.
  cron.schedule("*/5 * * * *", () => {
    runDailyRefill()
      .then((n) => n > 0 && console.log(`[refill] ${n} comptes rechargés`))
      .catch((e) => console.error("[refill] échec", e));
  });
  runDailyRefill().catch((e) => console.error("[refill] échec", e));
}
