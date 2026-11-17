export type Role = "USER" | "MODERATOR" | "ADMIN";
export type BetStatus = "PROPOSED" | "OPEN" | "SETTLED" | "CANCELLED" | "REJECTED";
export type WagerStatus = "PENDING" | "WON" | "LOST" | "REFUNDED";

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  balance: number;
  createdAt: string;
}

export interface BetOption {
  id: string;
  label: string;
  /** x100: fixed odds, or indicative pool odds */
  odds: number | null;
  total: number;
  wagerCount: number;
}

export interface MyWager {
  id: string;
  optionId: string;
  amount: number;
  oddsX100: number | null;
  status: WagerStatus;
  payout: number | null;
}

export interface Bet {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: BetStatus;
  oddsEnabled: boolean;
  closesAt: string;
  createdAt: string;
  settledAt: string | null;
  acceptingWagers: boolean;
  /** Match bets: wagers refused before this date */
  opensAt: string | null;
  matchId: string | null;
  votesRequired: number;
  voteCount: number;
  myVote: boolean;
  creator: { id: string; username: string };
  group: { id: string; name: string } | null;
  winningOptionId: string | null;
  canModerate: boolean;
  pool: number;
  options: BetOption[];
  myWagers: MyWager[];
}

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED";

export interface Match {
  id: string;
  category: string;
  homeName: string;
  awayName: string;
  location: string | null;
  startsAt: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  liveNote: string | null;
  updatedAt: string;
  bet: {
    id: string;
    status: BetStatus;
    opensAt: string | null;
    closesAt: string;
    oddsEnabled: boolean;
    acceptingWagers: boolean;
    options: { id: string; label: string; odds: number | null }[];
  } | null;
}

export interface LeaderRow {
  userId: string;
  username: string;
  profit: number;
  staked: number;
  bets: number;
  wins: number;
  balance: number;
}

export interface Transaction {
  id: string;
  type: "SIGNUP_BONUS" | "DAILY_REFILL" | "BET_STAKE" | "BET_PAYOUT" | "BET_REFUND" | "ADMIN_ADJUST";
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface WagerHistory {
  id: string;
  amount: number;
  oddsX100: number | null;
  payout: number | null;
  status: WagerStatus;
  createdAt: string;
  optionLabel: string;
  bet: { id: string; title: string; category: string; status: BetStatus; closesAt: string; oddsEnabled: boolean };
}

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  activeBets: number;
  isOwner: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  ownerId: string;
  members: { id: string; username: string; role: "OWNER" | "MEMBER" }[];
}

export interface Settings {
  refillThreshold: number;
  refillHour: number;
  signupBonus: number;
  votesRequired: number;
  oddsFeatureEnabled: boolean;
  minStake: number;
  maxStake: number;
  betOpenDays: number;
  lastRefillDate: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body ? { "content-type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Pas de connexion. Vérifie ton réseau et réessaie.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Erreur inattendue.");
  return data as T;
}
