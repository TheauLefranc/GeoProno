import { Router } from "express";
import { z } from "zod";
import { param, requireAuth } from "../lib/auth";
import { badRequest } from "../lib/http";
import { CATEGORIES } from "../services/categories";
import { BRACKET_SIZES } from "../services/bracketLogic";
import {
  cancelBracket,
  createBracket,
  listBrackets,
  loadBracket,
  lockBracket,
  saveEntry,
  serializeBracket,
  setResult,
  updateBracket,
} from "../services/brackets";

export const bracketsRouter = Router();
bracketsRouter.use(requireAuth);

const slot = z.string().max(40, "40 caractères maximum par participant");
const title = z.string().trim().min(3, "3 caractères minimum").max(80, "80 caractères maximum");

bracketsRouter.get("/", async (req, res) => {
  const { view } = z.object({ view: z.enum(["active", "done"]).default("active") }).parse(req.query);
  const brackets = await listBrackets(view);
  res.json({ brackets: brackets.map((b) => serializeBracket(b, req.user)) });
});

bracketsRouter.get("/:id", async (req, res) => {
  res.json({ bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});

bracketsRouter.post("/", async (req, res) => {
  const input = z
    .object({
      title,
      category: z.enum(CATEGORIES),
      size: z.number().int().refine((n) => (BRACKET_SIZES as readonly number[]).includes(n), "taille 4, 8, 16 ou 32"),
      participants: z.array(slot).max(32),
      locksAt: z.coerce.date(),
    })
    .parse(req.body);
  if (input.locksAt.getTime() > Date.now() + 90 * 24 * 3600_000) throw badRequest("Fin des pronostics à 90 jours maximum.");
  const b = await createBracket(req.user!, input);
  res.status(201).json({ bracket: serializeBracket(await loadBracket(b.id), req.user, true) });
});

bracketsRouter.patch("/:id", async (req, res) => {
  const patch = z
    .object({ title: title.optional(), participants: z.array(slot).max(32).optional(), locksAt: z.coerce.date().optional() })
    .parse(req.body);
  await updateBracket(req.user!, param(req, "id"), patch);
  res.json({ bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});

bracketsRouter.put("/:id/entry", async (req, res) => {
  const { picks, amount } = z
    .object({ picks: z.array(z.number().int()).max(31), amount: z.number().int("mise entière").optional() })
    .parse(req.body);
  const result = await saveEntry(req.user!, param(req, "id"), picks, amount);
  res.status(result.created ? 201 : 200).json({ ...result, bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});

bracketsRouter.post("/:id/lock", async (req, res) => {
  await lockBracket(req.user!, param(req, "id"));
  res.json({ bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});

bracketsRouter.post("/:id/results", async (req, res) => {
  const { match, winner, score } = z
    .object({ match: z.number().int(), winner: z.number().int().nullable(), score: z.string().max(20).nullable().optional() })
    .parse(req.body);
  const result = await setResult(req.user!, param(req, "id"), match, winner, score);
  res.json({ ...result, bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});

bracketsRouter.post("/:id/cancel", async (req, res) => {
  await cancelBracket(req.user!, param(req, "id"));
  res.json({ bracket: serializeBracket(await loadBracket(param(req, "id")), req.user, true) });
});
