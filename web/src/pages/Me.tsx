import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, LogOut, Shield } from "lucide-react";
import { api, type Transaction, type WagerHistory } from "../lib/api";
import { ago, categoryLabel, coins, odds, signed } from "../lib/format";
import { usePublicConfig } from "../lib/hooks";
import { isStaff, useSession, useSetUser } from "../lib/session";
import { Led } from "../components/Led";
import { Empty, ErrorBox, Skeletons, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { WagerPill } from "./Bet";

const TX_LABEL: Record<Transaction["type"], string> = {
  SIGNUP_BONUS: "Bonus d'inscription",
  DAILY_REFILL: "Recharge du matin",
  BET_STAKE: "Mise",
  BET_PAYOUT: "Gain",
  BET_REFUND: "Remboursement",
  ADMIN_ADJUST: "Ajustement",
};

export function MePage() {
  const { user } = useSession();
  const setUser = useSetUser();
  const cfg = usePublicConfig();
  const [tab, setTab] = useState<"bets" | "tx">("bets");
  const stats = useQuery({
    queryKey: ["me-stats"],
    queryFn: () => api<{ profit: number; settledCount: number; wonCount: number; pendingCount: number; pendingStake: number }>("/me/stats"),
  });
  const logout = useMutation({ mutationFn: () => api("/auth/logout", { method: "POST" }), onSuccess: () => setUser(null) });
  const s = stats.data;

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <h1>{user?.username}</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={16} aria-hidden /> Déconnexion
        </button>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="label-c">Bénéfice</span>
          <Led value={s ? signed(s.profit) : "…"} className={!s || s.profit === 0 ? "muted" : s.profit < 0 ? "red" : "blue"} />
        </div>
        <div className="stat">
          <span className="label-c">En jeu</span>
          <Led value={s ? coins(s.pendingStake) : "…"} />
        </div>
        <div className="stat">
          <span className="label-c">Réussite</span>
          <Led value={s ? (s.settledCount ? `${Math.round((s.wonCount / s.settledCount) * 100)}%` : "—") : "…"} />
        </div>
      </div>
      {cfg.data && (
        <p style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 12 }}>
          Chaque matin à {cfg.data.refillHour} h, ton solde remonte à {coins(cfg.data.refillThreshold)} pièces s'il est en dessous.
        </p>
      )}

      {isStaff(user) && (
        <ul className="list" style={{ marginTop: 16 }}>
          <li>
            <Link to="/admin" className="list-item">
              <Shield size={20} aria-hidden />
              <div className="list-main">
                <div className="list-title">Administration</div>
                <div className="list-sub">Règles du jeu, comptes, recharges</div>
              </div>
              <ChevronRight size={18} aria-hidden color="var(--ink-3)" />
            </Link>
          </li>
        </ul>
      )}

      <section className="section">
        <div className="segmented" role="group" aria-label="Historique">
          <button aria-pressed={tab === "bets"} onClick={() => setTab("bets")}>
            Mes paris
          </button>
          <button aria-pressed={tab === "tx"} onClick={() => setTab("tx")}>
            Mouvements
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{tab === "bets" ? <WagerList /> : <TxList />}</div>
      </section>

      <PasswordForm />
    </div>
  );
}

function WagerList() {
  const q = useQuery({ queryKey: ["me-wagers"], queryFn: () => api<{ wagers: WagerHistory[] }>("/me/wagers").then((d) => d.wagers) });
  if (q.isLoading) return <Skeletons n={3} h={60} />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data!.length)
    return (
      <Empty
        title="Aucun pari pour l'instant"
        action={
          <Link to="/" className="btn btn-gold btn-sm">
            Voir les paris ouverts
          </Link>
        }
      />
    );
  return (
    <ul className="list">
      {q.data!.map((w) => (
        <li key={w.id}>
          <Link to={`/paris/${w.bet.id}`} className="list-item">
            <div className="list-main">
              <div className="list-title">{w.bet.title}</div>
              <div className="list-sub">
                {w.optionLabel} · {w.oddsX100 ? `cote ${odds(w.oddsX100)}` : "cagnotte"} · {categoryLabel(w.bet.category)} · {ago(w.createdAt)}
              </div>
            </div>
            <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
              <span className="amount">{coins(w.amount)}</span>
              <WagerPill status={w.status} payout={w.payout} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TxList() {
  const q = useQuery({ queryKey: ["me-tx"], queryFn: () => api<{ transactions: Transaction[] }>("/me/transactions").then((d) => d.transactions) });
  if (q.isLoading) return <Skeletons n={4} h={60} />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data!.length) return <Empty title="Aucun mouvement" />;
  return (
    <ul className="list">
      {q.data!.map((t) => (
        <li key={t.id} className="list-item">
          <div className="list-main">
            <div className="list-title">{TX_LABEL[t.type]}</div>
            <div className="list-sub">
              {t.note ? `${t.note} · ` : ""}
              {ago(t.createdAt)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`amount ${t.amount > 0 ? "pos" : "neg"}`}>{signed(t.amount)}</div>
            <div className="list-sub">solde {coins(t.balanceAfter)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const m = useMutation({
    mutationFn: () => api("/auth/password", { body: { current, next } }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      toast("Mot de passe modifié");
    },
  });
  return (
    <section className="section">
      <h2>Mot de passe</h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <input className="input" type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={current} onChange={(e) => setCurrent(e.target.value)} required aria-label="Mot de passe actuel" />
        <input className="input" type="password" autoComplete="new-password" placeholder="Nouveau (8 caractères min.)" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required aria-label="Nouveau mot de passe" />
        {m.error && <div className="alert">{m.error.message}</div>}
        <button className="btn btn-ghost" disabled={m.isPending}>
          {m.isPending ? <Spinner /> : "Changer le mot de passe"}
        </button>
      </form>
    </section>
  );
}
