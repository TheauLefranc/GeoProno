import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireAuth } from "../lib/auth";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/wagers", async (req, res) => {
  const wagers = await prisma.wager.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      option: { select: { label: true } },
      bet: {
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          closesAt: true,
          oddsEnabled: true,
          winningOptionId: true,
          bracket: { select: { id: true } },
        },
      },
    },
  });
  res.json({
    wagers: wagers.map((w) => ({
      id: w.id,
      amount: w.amount,
      oddsX100: w.oddsX100,
      payout: w.payout,
      status: w.status,
      createdAt: w.createdAt,
      optionLabel: w.option.label,
      bet: { ...w.bet, bracket: undefined, bracketId: w.bet.bracket?.id ?? null },
    })),
  });
});

meRouter.get("/transactions", async (req, res) => {
  const { before } = z.object({ before: z.coerce.date().optional() }).parse(req.query);
  const items = await prisma.transaction.findMany({
    where: { userId: req.user!.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ transactions: items });
});

meRouter.get("/stats", async (req, res) => {
  const userId = req.user!.id;
  const [settled, won, pending] = await Promise.all([
    prisma.wager.aggregate({ where: { userId, status: { in: ["WON", "LOST"] } }, _sum: { amount: true, payout: true }, _count: { _all: true } }),
    prisma.wager.count({ where: { userId, status: "WON" } }),
    prisma.wager.aggregate({ where: { userId, status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  res.json({
    profit: (settled._sum.payout ?? 0) - (settled._sum.amount ?? 0),
    settledCount: settled._count._all,
    wonCount: won,
    pendingCount: pending._count._all,
    pendingStake: pending._sum.amount ?? 0,
  });
});
