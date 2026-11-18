import { Router } from "express";
import { randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/db";
import { conflict, forbidden, notFound } from "../lib/http";
import { param, requireAuth } from "../lib/auth";
import { leaderboard } from "../services/leaderboard";

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

// No 0/O/1/I so codes survive being read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function membership(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, include: { group: true } });
  if (!m) throw notFound("Groupe introuvable");
  return m;
}

groupsRouter.get("/", async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.user!.id } } },
    include: {
      _count: { select: { members: true } },
      bets: { where: { status: { in: ["OPEN", "PROPOSED"] } }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g._count.members,
      activeBets: g.bets.length,
      isOwner: g.ownerId === req.user!.id,
    })),
  });
});

groupsRouter.post("/", async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(2, "2 caractères minimum").max(40, "40 caractères maximum") }).parse(req.body);
  const group = await prisma.group.create({
    data: {
      name,
      inviteCode: newCode(),
      ownerId: req.user!.id,
      members: { create: { userId: req.user!.id, role: "OWNER" } },
    },
  });
  res.status(201).json({ group: { id: group.id } });
});

// Limits invite-code guessing.
const joinLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

groupsRouter.post("/join", joinLimiter, async (req, res) => {
  const { code } = z.object({ code: z.string().trim().toUpperCase().min(4) }).parse(req.body);
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) throw notFound("Aucun groupe avec ce code. Vérifie les lettres.");
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: req.user!.id } },
    update: {},
    create: { groupId: group.id, userId: req.user!.id },
  });
  res.json({ group: { id: group.id } });
});

groupsRouter.get("/:id", async (req, res) => {
  const id = param(req, "id");
  const m = await membership(id, req.user!.id);
  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const rows = await leaderboard({ groupId: id, userIds: members.map((x) => x.userId) });
  res.json({
    group: {
      id,
      name: m.group.name,
      inviteCode: m.group.inviteCode,
      isOwner: m.group.ownerId === req.user!.id,
      ownerId: m.group.ownerId,
      members: members.map((x) => ({ id: x.user.id, username: x.user.username, role: x.role })),
    },
    leaderboard: rows,
  });
});

groupsRouter.post("/:id/code", async (req, res) => {
  const m = await membership(param(req, "id"), req.user!.id);
  if (m.group.ownerId !== req.user!.id) throw forbidden("Seul le créateur du groupe peut changer le code.");
  const g = await prisma.group.update({ where: { id: m.groupId }, data: { inviteCode: newCode() } });
  res.json({ inviteCode: g.inviteCode });
});

groupsRouter.delete("/:id/members/:userId", async (req, res) => {
  const id = param(req, "id");
  const target = param(req, "userId");
  const m = await membership(id, req.user!.id);
  const isOwner = m.group.ownerId === req.user!.id;
  if (target !== req.user!.id && !isOwner) throw forbidden();
  if (target === m.group.ownerId) throw conflict("Le créateur ne peut pas quitter son groupe ; supprime-le plutôt.");
  await prisma.groupMember.deleteMany({ where: { groupId: id, userId: target } });
  res.status(204).end();
});

groupsRouter.delete("/:id", async (req, res) => {
  const m = await membership(param(req, "id"), req.user!.id);
  if (m.group.ownerId !== req.user!.id) throw forbidden("Seul le créateur peut supprimer le groupe.");
  const pending = await prisma.wager.count({ where: { status: "PENDING", bet: { groupId: m.groupId } } });
  if (pending > 0) throw conflict("Règle ou annule les paris en cours du groupe avant de le supprimer.");
  await prisma.group.delete({ where: { id: m.groupId } });
  res.status(204).end();
});
