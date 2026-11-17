import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

export interface LeaderRow {
  userId: string;
  username: string;
  profit: number;
  staked: number;
  bets: number;
  wins: number;
  balance: number;
}

/**
 * Ranking by net profit on settled wagers (payouts minus stakes).
 * Refunds and daily refills never count, so topping up does not climb the board.
 */
export async function leaderboard(
  opts: { since?: Date; /** null = public bets only */ groupId?: string | null; userIds?: string[] } = {},
): Promise<LeaderRow[]> {
  const betFilter: Prisma.BetWhereInput = {};
  if (opts.since) betFilter.settledAt = { gte: opts.since };
  if (opts.groupId !== undefined) betFilter.groupId = opts.groupId;

  const where: Prisma.WagerWhereInput = {
    status: { in: ["WON", "LOST"] },
    bet: betFilter,
    ...(opts.userIds ? { userId: { in: opts.userIds } } : {}),
  };

  const [sums, wins] = await Promise.all([
    prisma.wager.groupBy({ by: ["userId"], where, _sum: { amount: true, payout: true }, _count: { _all: true } }),
    prisma.wager.groupBy({ by: ["userId"], where: { ...where, status: "WON" }, _count: { _all: true } }),
  ]);

  const userIds = opts.userIds ?? sums.map((s) => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, balance: true },
  });
  const winMap = new Map(wins.map((w) => [w.userId, w._count._all]));
  const sumMap = new Map(sums.map((s) => [s.userId, s]));

  return users
    .map((u) => {
      const s = sumMap.get(u.id);
      const staked = s?._sum.amount ?? 0;
      return {
        userId: u.id,
        username: u.username,
        profit: (s?._sum.payout ?? 0) - staked,
        staked,
        bets: s?._count._all ?? 0,
        wins: winMap.get(u.id) ?? 0,
        balance: u.balance,
      };
    })
    .sort((a, b) => b.profit - a.profit || b.wins - a.wins || a.username.localeCompare(b.username));
}
