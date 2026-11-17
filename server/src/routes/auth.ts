import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/db";
import { config } from "../lib/config";
import { badRequest, conflict, HttpError } from "../lib/http";
import { clearSession, requireAuth, setSession } from "../lib/auth";
import { applyBalanceChange } from "../services/ledger";
import { getSettings } from "../services/settings";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  email: z.email("adresse email invalide").transform((s) => s.trim().toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3, "3 caractères minimum")
    .max(20, "20 caractères maximum")
    .regex(/^[\p{L}0-9_.-]+$/u, "lettres, chiffres, _ . - uniquement"),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

export async function publicUser(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, email: true, username: true, role: true, balance: true, createdAt: true },
  });
}

/** Public rules of the game, shown in the UI. */
authRouter.get("/config", async (_req, res) => {
  const s = await getSettings();
  res.json({
    allowedEmailDomains: config.allowedEmailDomains,
    oddsFeatureEnabled: s.oddsFeatureEnabled,
    votesRequired: s.votesRequired,
    refillThreshold: s.refillThreshold,
    refillHour: s.refillHour,
    minStake: s.minStake,
    maxStake: s.maxStake,
  });
});

authRouter.post("/register", limiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const domain = input.email.split("@")[1];
  if (config.allowedEmailDomains.length && !config.allowedEmailDomains.includes(domain)) {
    throw badRequest(`Utilise ton adresse de l'école (${config.allowedEmailDomains.map((d) => "@" + d).join(", ")}).`);
  }
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: { equals: input.username, mode: "insensitive" } }] },
    select: { email: true },
  });
  if (exists) throw conflict(exists.email === input.email ? "Un compte existe déjà avec cet email." : "Ce pseudo est déjà pris.");

  const settings = await getSettings();
  const isFirstUser = (await prisma.user.count()) === 0;
  const role = isFirstUser || config.adminEmails.includes(input.email) ? "ADMIN" : "USER";
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email: input.email, username: input.username, passwordHash, role } });
    await applyBalanceChange(tx, { userId: u.id, amount: settings.signupBonus, type: "SIGNUP_BONUS", note: "Bienvenue sur GeoProno" });
    return u;
  });
  setSession(res, user.id);
  res.status(201).json({ user: await publicUser(user.id) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Email ou mot de passe incorrect.");
  }
  setSession(res, user.id);
  res.json({ user: await publicUser(user.id) });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await publicUser(req.user!.id) });
});

authRouter.post("/password", requireAuth, limiter, async (req, res) => {
  const { current, next } = z.object({ current: z.string(), next: z.string().min(8, "8 caractères minimum").max(200) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  res.status(204).end();
});
