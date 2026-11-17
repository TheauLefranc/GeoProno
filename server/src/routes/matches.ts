import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db";
import { badRequest } from "../lib/http";
import { param, requireAuth, requireRole } from "../lib/auth";
import { CATEGORIES, MAIN_CATEGORIES, subcategoriesOf } from "../services/categories";
import {
  cancelMatch,
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
const staff = requireRole("ADMIN", "MODERATOR");

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
    results: { where: { status: { in: ["FINISHED", "CANCELLED"] } }, orderBy: { startsAt: "desc" } },
  } as const satisfies Record<string, { where: Prisma.MatchWhereInput; orderBy: Prisma.MatchOrderByWithRelationInput }>;
  const v = byView[q.view];
  const [matches, liveCount] = await Promise.all([
    prisma.match.findMany({ where: { AND: [v.where, cat] }, orderBy: v.orderBy, include: matchInclude, take: 100 }),
    prisma.match.count({ where: { status: "LIVE" } }),
  ]);
  res.json({ matches: matches.map(serializeMatch), liveCount });
});

matchesRouter.get("/:id", async (req, res) => {
  res.json({ match: serializeMatch(await loadMatch(param(req, "id"))) });
});

const oddsSchema = z.number().min(1.01).max(100).optional();
const name = z.string().trim().min(1, "nom vide").max(40, "40 caractères maximum");

matchesRouter.post("/", staff, async (req, res) => {
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
  if (input.homeName.toLowerCase() === input.awayName.toLowerCase()) throw badRequest("Les deux équipes ont le même nom.");
  const match = await createMatch(req.user!, input);
  res.status(201).json({ match: serializeMatch(await loadMatch(match.id)) });
});

matchesRouter.patch("/:id", staff, async (req, res) => {
  const patch = z
    .object({
      homeName: name.optional(),
      awayName: name.optional(),
      location: z.string().trim().max(80).nullable().optional(),
      startsAt: z.coerce.date().optional(),
    })
    .parse(req.body);
  await updateMatch(param(req, "id"), patch);
  res.json({ match: serializeMatch(await loadMatch(param(req, "id"))) });
});

const score = z.number().int().min(0).max(999);

matchesRouter.post("/:id/score", staff, async (req, res) => {
  const body = z
    .object({ homeScore: score, awayScore: score, liveNote: z.string().trim().max(40).nullable().optional(), live: z.boolean().optional() })
    .parse(req.body);
  await setScore(param(req, "id"), body);
  res.json({ match: serializeMatch(await loadMatch(param(req, "id"))) });
});

matchesRouter.post("/:id/finish", staff, async (req, res) => {
  const { homeScore, awayScore } = z.object({ homeScore: score, awayScore: score }).parse(req.body);
  const result = await finishMatch(req.user!, param(req, "id"), homeScore, awayScore);
  res.json({ ...result, match: serializeMatch(await loadMatch(param(req, "id"))) });
});

matchesRouter.post("/:id/cancel", staff, async (req, res) => {
  await cancelMatch(req.user!, param(req, "id"));
  res.json({ match: serializeMatch(await loadMatch(param(req, "id"))) });
});
