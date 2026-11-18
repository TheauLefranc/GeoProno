import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { badRequest, notFound } from "../lib/http";

const LINK_TTL_MS = 60 * 60_000; // 1 hour

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Admin-generated, single-use reset link. Only the token's hash is stored, so
 * a database leak cannot be turned into working links. Generating a new link
 * revokes the user's previous unused ones.
 */
export async function createResetLink(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  if (!user) throw notFound("Compte introuvable");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await prisma.$transaction([
    prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordReset.create({ data: { tokenHash: hash(token), userId, createdById: adminId, expiresAt } }),
  ]);
  return { path: `/reinitialisation/${token}`, expiresAt, username: user.username };
}

async function findValid(token: string) {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
    throw badRequest("Ce lien n'est plus valable. Demande un nouveau lien à un admin.");
  }
  return reset;
}

export async function checkResetLink(token: string) {
  const reset = await findValid(token);
  return { username: reset.user.username, expiresAt: reset.expiresAt };
}

/** Sets the new password, burns the link and logs out every other session. */
export async function useResetLink(token: string, password: string) {
  const reset = await findValid(token);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw badRequest("Ce lien vient d'être utilisé.");
    return tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: { id: true, sessionVersion: true },
    });
  });
  return user;
}
