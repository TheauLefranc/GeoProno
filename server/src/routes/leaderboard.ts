import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { leaderboard } from "../services/leaderboard";

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

leaderboardRouter.get("/", async (req, res) => {
  const { period } = z.object({ period: z.enum(["all", "week", "month"]).default("all") }).parse(req.query);
  const days = period === "week" ? 7 : period === "month" ? 30 : 0;
  const since = days ? new Date(Date.now() - days * 24 * 3600_000) : undefined;
  // Global ranking only counts public bets, so private group challenges stay private.
  const rows = await leaderboard({ since, groupId: null });
  res.json({ rows: rows.slice(0, 200), me: rows.findIndex((r) => r.userId === req.user!.id) });
});
