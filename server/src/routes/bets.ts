import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db";
import { badRequest, forbidden } from "../lib/http";
import { param, requireAuth } from "../lib/auth";
import {
  betInclude,
  cancelBet,
  CATEGORIES,
  loadBet,
  placeWager,
  proposeBet,
  serializeBets,
  setStatusFromModeration,
  settleBet,
  updateOdds,
  vote,
} from "../services/bets";
import { MAIN_CATEGORIES, subcategoriesOf } from "../services/categories";

export const betsRouter = Router();
betsRouter.use(requireAuth);

const VIEWS = ["open", "proposed", "awaiting", "done"] as const;

betsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      view: z.enum(VIEWS).default("open"),
      /** Subcategory (e.g. BABYFOOT) */
      category: z.enum(CATEGORIES).optional(),
      /** Main category (e.g. SPORT): every subcategory under it */
      main: z.enum(MAIN_CATEGORIES).optional(),
      groupId: z.string().optional(),
    })
    .parse(req.query);
  const categoryFilter: Prisma.BetWhereInput = q.category
    ? { category: q.category }
    : q.main
      ? { category: { in: subcategoriesOf(q.main) } }
      : {};
  const user = req.user!;
  const now = new Date();

  let scope: Prisma.BetWhereInput;
  if (q.groupId) {
    const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: q.groupId, userId: user.id } } });
    if (!m) throw forbidden("Tu ne fais pas partie de ce groupe.");
    scope = { groupId: q.groupId };
  } else {
    scope = { OR: [{ groupId: null }, { group: { members: { some: { userId: user.id } } } }] };
  }

  const byView: Record<(typeof VIEWS)[number], { where: Prisma.BetWhereInput; orderBy: Prisma.BetOrderByWithRelationInput }> = {
    // Match bets scheduled to open later stay off the feed until opensAt.
    open: {
      where: { status: "OPEN", closesAt: { gt: now }, OR: [{ opensAt: null }, { opensAt: { lte: now } }] },
      orderBy: { closesAt: "asc" },
    },
    proposed: { where: { status: "PROPOSED", closesAt: { gt: now } }, orderBy: { createdAt: "desc" } },
    awaiting: { where: { status: "OPEN", closesAt: { lte: now } }, orderBy: { closesAt: "asc" } },
    done: { where: { status: { in: ["SETTLED", "CANCELLED"] } }, orderBy: { settledAt: "desc" } },
  };
  const v = byView[q.view];
  const bets = await prisma.bet.findMany({
    where: { AND: [scope, v.where, categoryFilter] },
    orderBy: v.orderBy,
    include: betInclude,
    take: 60,
  });
  res.json({ bets: await serializeBets(bets, user) });
});

betsRouter.get("/counts", async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const scope: Prisma.BetWhereInput = { OR: [{ groupId: null }, { group: { members: { some: { userId: user.id } } } }] };
  const [proposedToVote, awaiting] = await Promise.all([
    prisma.bet.count({ where: { AND: [scope, { status: "PROPOSED", closesAt: { gt: now }, votes: { none: { userId: user.id } } }] } }),
    prisma.bet.count({ where: { AND: [scope, { status: "OPEN", closesAt: { lte: now } }] } }),
  ]);
  res.json({ proposedToVote, awaiting });
});

betsRouter.get("/:id", async (req, res) => {
  const bet = await loadBet(param(req, "id"), req.user);
  const [data] = await serializeBets([bet], req.user);
  res.json({ bet: data });
});

const optionSchema = z.object({
  label: z.string().trim().min(1, "option vide").max(40, "40 caractères maximum"),
  odds: z.number().min(1.01, "cote minimum 1.01").max(100, "cote maximum 100").optional(),
});

betsRouter.post("/", async (req, res) => {
  const input = z
    .object({
      title: z.string().trim().min(3, "3 caractères minimum").max(120, "120 caractères maximum"),
      description: z.string().trim().max(500).optional(),
      category: z.enum(CATEGORIES),
      closesAt: z.coerce.date(),
      options: z.array(optionSchema).min(2, "au moins 2 options").max(6, "6 options maximum"),
      oddsEnabled: z.boolean().default(false),
      groupId: z.string().optional(),
    })
    .parse(req.body);
  if (input.closesAt.getTime() > Date.now() + 60 * 24 * 3600_000) throw badRequest("Clôture à 60 jours maximum.");
  const id = await proposeBet(req.user!, input);
  const [bet] = await serializeBets([await loadBet(id, req.user)], req.user);
  res.status(201).json({ bet });
});

betsRouter.post("/:id/vote", async (req, res) => {
  await vote(req.user!, param(req, "id"), true);
  const [bet] = await serializeBets([await loadBet(param(req, "id"), req.user)], req.user);
  res.json({ bet });
});

betsRouter.delete("/:id/vote", async (req, res) => {
  await vote(req.user!, param(req, "id"), false);
  const [bet] = await serializeBets([await loadBet(param(req, "id"), req.user)], req.user);
  res.json({ bet });
});

betsRouter.post("/:id/wagers", async (req, res) => {
  const { optionId, amount } = z.object({ optionId: z.string(), amount: z.number().int("mise entière") }).parse(req.body);
  const result = await placeWager(req.user!, param(req, "id"), optionId, amount);
  const [bet] = await serializeBets([await loadBet(param(req, "id"), req.user)], req.user);
  res.status(201).json({ ...result, bet });
});

betsRouter.post("/:id/approve", async (req, res) => {
  await setStatusFromModeration(req.user!, param(req, "id"), "approve");
  res.status(204).end();
});

betsRouter.post("/:id/reject", async (req, res) => {
  await setStatusFromModeration(req.user!, param(req, "id"), "reject");
  res.status(204).end();
});

betsRouter.patch("/:id/odds", async (req, res) => {
  const { oddsEnabled, odds } = z
    .object({ oddsEnabled: z.boolean(), odds: z.record(z.string(), z.number().min(1.01).max(100)).default({}) })
    .parse(req.body);
  await updateOdds(req.user!, param(req, "id"), oddsEnabled, odds);
  const [bet] = await serializeBets([await loadBet(param(req, "id"), req.user)], req.user);
  res.json({ bet });
});

betsRouter.post("/:id/settle", async (req, res) => {
  const { optionId } = z.object({ optionId: z.string() }).parse(req.body);
  await settleBet(req.user!, param(req, "id"), optionId);
  res.status(204).end();
});

betsRouter.post("/:id/cancel", async (req, res) => {
  await cancelBet(req.user!, param(req, "id"));
  res.status(204).end();
});
