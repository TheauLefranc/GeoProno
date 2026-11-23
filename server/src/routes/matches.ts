import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db";
import { badRequest, forbidden } from "../lib/http";
import type { Request, Response, NextFunction } from "express";
import { param, requireAuth } from "../lib/auth";
import { canManageCategory, CATEGORIES, isScopedManager, MAIN_CATEGORIES, subcategoriesOf } from "../services/categories";
import {
  cancelMatch,
  changeMatchCategory,
  createMatch,
  finishMatch,
  loadMatch,
  matchInclude,
  serializeMatch,
  setScore,
  updateMatch,
} from "../services/matches";

export const matchesRouter = Router();
matchesRouter.use(requireAuth);
/** Only someone who manages this match category (staff, or a sport manager in scope) may run it. */
async function canRunMatch(req: Request, _res: Response, next: NextFunction) {
  try {
    const m = await loadMatch(param(req, "id"));
    if (!canManageCategory(req.user, m.category)) throw forbidden("Tu ne gères pas ce sport.");
    next();
  } catch (e) {
    next(e);
  }
}

matchesRouter.get("/", async (req, res) => {
  const q = z
    .object({
      view: z.enum(["upcoming", "live", "results"]).default("upcoming"),
      category: z.enum(CATEGORIES).optional(),
      main: z.enum(MAIN_CATEGORIES).optional(),
    })
    .parse(req.query);
  const cat: Prisma.MatchWhereInput = q.category
    ? { category: q.category }
    : q.main
      ? { category: { in: subcategoriesOf(q.main) } }
      : {};
  const byView = {
    upcoming: { where: { status: "SCHEDULED" }, orderBy: { startsAt: "asc" } },
    live: { where: { status: "LIVE" }, orderBy: { startsAt: "asc" } },
    // Cancelled matches never happened: they stay out of the past results.
    results: { where: { status: "FINISHED" }, orderBy: { startsAt: "desc" } },
  } as const satisfies Record<string, { where: Prisma.MatchWhereInput; orderBy: Prisma.MatchOrderByWithRelationInput }>;
  const v = byView[q.view];
  const [matches, liveCount] = await Promise.all([
    prisma.match.findMany({ where: { AND: [v.where, cat] }, orderBy: v.orderBy, include: matchInclude, take: 100 }),
    prisma.match.count({ where: { status: "LIVE" } }),
  ]);
  res.json({ matches: matches.map((m) => serializeMatch(m, req.user)), liveCount });
});

matchesRouter.get("/:id", async (req, res) => {
  res.json({ match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});

const oddsSchema = z.number().min(1.01).max(100).optional();
const name = z.string().trim().min(1, "nom vide").max(40, "40 caractères maximum");

matchesRouter.post("/", async (req, res) => {
  const input = z
    .object({
      category: z.enum(CATEGORIES),
      homeName: name,
      awayName: name,
      location: z.string().trim().max(80).optional(),
      startsAt: z.coerce.date(),
      withBet: z.boolean().default(true),
      allowDraw: z.boolean().default(false),
      oddsEnabled: z.boolean().default(false),
      odds: z.object({ home: oddsSchema, draw: oddsSchema, away: oddsSchema }).optional(),
    })
    .parse(req.body);
  if (!canManageCategory(req.user, input.category)) throw forbidden("Tu ne gères pas ce sport.");
  // Sport managers only create pool bets: fixed odds they set themselves could be abused.
  if (isScopedManager(req.user) && input.withBet && input.oddsEnabled) {
    throw forbidden("Les cotes fixes sont réservées aux admins et modérateurs : choisis la cagnotte.");
  }
  if (input.homeName.toLowerCase() === input.awayName.toLowerCase()) throw badRequest("Les deux équipes ont le même nom.");
  const match = await createMatch(req.user!, input);
  res.status(201).json({ match: serializeMatch(await loadMatch(match.id), req.user) });
});

/** Fix a wrong sport at any stage; checked against both the old and new category. */
matchesRouter.patch("/:id/category", async (req, res) => {
  const { category } = z.object({ category: z.enum(CATEGORIES) }).parse(req.body);
  await changeMatchCategory(req.user!, param(req, "id"), category);
  res.json({ match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});

matchesRouter.patch("/:id", canRunMatch, async (req, res) => {
  const patch = z
    .object({
      homeName: name.optional(),
      awayName: name.optional(),
      location: z.string().trim().max(80).nullable().optional(),
      startsAt: z.coerce.date().optional(),
    })
    .parse(req.body);
  await updateMatch(param(req, "id"), patch);
  res.json({ match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});

const score = z.number().int().min(0).max(999);

matchesRouter.post("/:id/score", canRunMatch, async (req, res) => {
  const body = z
    .object({ homeScore: score, awayScore: score, liveNote: z.string().trim().max(40).nullable().optional(), live: z.boolean().optional() })
    .parse(req.body);
  await setScore(param(req, "id"), body);
  res.json({ match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});

matchesRouter.post("/:id/finish", canRunMatch, async (req, res) => {
  const { homeScore, awayScore } = z.object({ homeScore: score, awayScore: score }).parse(req.body);
  const result = await finishMatch(req.user!, param(req, "id"), homeScore, awayScore);
  res.json({ ...result, match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});

matchesRouter.post("/:id/cancel", canRunMatch, async (req, res) => {
  await cancelMatch(req.user!, param(req, "id"));
  res.json({ match: serializeMatch(await loadMatch(param(req, "id")), req.user) });
});
