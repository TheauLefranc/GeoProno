import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type LeaderRow } from "../lib/api";
import { useSession } from "../lib/session";
import { Podium, RankList } from "../components/Ranking";
import { Empty, ErrorBox, Skeletons } from "../components/States";

const PERIODS = [
  { id: "week", label: "7 jours" },
  { id: "month", label: "30 jours" },
  { id: "all", label: "Depuis le début" },
];

export function LeaderboardPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState("all");
  const lb = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api<{ rows: LeaderRow[]; me: number }>(`/leaderboard?period=${period}`),
  });
  const rows = lb.data?.rows ?? [];

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <h1>Classement</h1>
      </div>
      <div className="segmented" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "12px 0 16px" }}>
        Classé au bénéfice net sur les paris publics réglés : gains moins mises. Les recharges du matin ne comptent pas.
      </p>
      {lb.isLoading ? (
        <Skeletons n={2} h={120} />
      ) : lb.error ? (
        <ErrorBox error={lb.error} retry={() => lb.refetch()} />
      ) : rows.length === 0 ? (
        <Empty title="Personne au classement">Le classement se remplit dès qu'un premier pari est réglé.</Empty>
      ) : (
        <>
          <Podium rows={rows} />
          {lb.data!.me > 2 && (
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              Tu es {lb.data!.me + 1}
              <sup>e</sup> sur {rows.length}.
            </p>
          )}
          <RankList rows={rows} meId={user?.id} />
        </>
      )}
    </div>
  );
}
