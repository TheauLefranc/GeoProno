import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { HttpError } from "./http";

export const COOKIE = "gp_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function setSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "30d" });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

/** Loads the user from the session cookie when present. Never rejects. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
    if (user) req.user = user;
  } catch {
    // invalid or expired token: treated as signed out
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Connecte-toi pour continuer."));
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Connecte-toi pour continuer."));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Réservé aux modérateurs."));
    next();
  };
}

export const isStaff = (u?: SessionUser) => u?.role === "ADMIN" || u?.role === "MODERATOR";

/** Express 5 types params as string | string[]; routes here only use single params. */
export function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}
