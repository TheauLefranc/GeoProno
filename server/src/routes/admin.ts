import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { badRequest } from "../lib/http";
import { param, requireRole } from "../lib/auth";
import { applyBalanceChange } from "../services/ledger";
import { getSettings } from "../services/settings";
import { runDailyRefill } from "../services/refill";

export const adminRouter = Router();

adminRouter.get("/settings", requireRole("ADMIN", "MODERATOR"), async (_req, res) => {
  res.json({ settings: await getSettings() });
});

adminRouter.patch("/settings", requireRole("ADMIN"), async (req, res) => {
  const data = z
    .object({
      refillThreshold: z.number().int().min(0).max(1_000_000),
      refillHour: z.number().int().min(0).max(23),
      signupBonus: z.number().int().min(0).max(1_000_000),
      votesRequired: z.number().int().min(1).max(500),
      oddsFeatureEnabled: z.boolean(),
      minStake: z.number().int().min(1),
      maxStake: z.number().int().min(1),
    })
    .partial()
    .parse(req.body);
  const current = await getSettings();
  if ((data.minStake ?? current.minStake) > (data.maxStake ?? current.maxStake)) throw badRequest("La mise minimum dépasse la mise maximum.");
  const settings = await prisma.appSettings.update({ where: { id: 1 }, data });
  res.json({ settings });
});

adminRouter.post("/refill", requireRole("ADMIN"), async (_req, res) => {
  // Manual trigger: runs now and marks today as done.
  const count = await runDailyRefill(new Date(), true);
  res.json({ count });
});

adminRouter.get("/users", requireRole("ADMIN"), async (req, res) => {
  const { q } = z.object({ q: z.string().trim().optional() }).parse(req.query);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, email: true, username: true, role: true, balance: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ users });
});

adminRouter.patch("/users/:id", requireRole("ADMIN"), async (req, res) => {
  const id = param(req, "id");
  const { role, adjust, note } = z
    .object({
      role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
      adjust: z.number().int().optional(),
      note: z.string().trim().max(120).optional(),
    })
    .parse(req.body);
  if (role && id === req.user!.id && role !== "ADMIN") throw badRequest("Tu ne peux pas retirer ton propre rôle admin.");
  await prisma.$transaction(async (tx) => {
    if (role) await tx.user.update({ where: { id }, data: { role } });
    if (adjust) await applyBalanceChange(tx, { userId: id, amount: adjust, type: "ADMIN_ADJUST", note: note || "Ajustement admin" });
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, email: true, username: true, role: true, balance: true, createdAt: true },
  });
  res.json({ user });
});
