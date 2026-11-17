import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Copy, Plus } from "lucide-react";
import { api, type GroupDetail, type LeaderRow } from "../lib/api";
import { useAction } from "../lib/hooks";
import { useSession } from "../lib/session";
import { useBets } from "./Feed";
import { BetCard } from "../components/BetCard";
import { ProposalCard } from "../components/ProposalCard";
import { RankList } from "../components/Ranking";
import { Empty, ErrorBox, Skeletons } from "../components/States";
import { useToast } from "../components/Toast";

export function GroupPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "proposed" | "done">("open");
  const g = useQuery({
    queryKey: ["group", id],
    queryFn: () => api<{ group: GroupDetail; leaderboard: LeaderRow[] }>(`/groups/${id}`),
  });
  const bets = useBets(tab, undefined, id);
  const leave = useAction(() => api(`/groups/${id}/members/${user!.id}`, { method: "DELETE" }), [["groups"]]);
  const regen = useAction(() => api<{ inviteCode: string }>(`/groups/${id}/code`, { method: "POST" }), [["group", id]]);
  const remove = useAction(() => api(`/groups/${id}`, { method: "DELETE" }), [["groups"]]);

  if (g.isLoading)
    return (
      <div className="page" style={{ paddingTop: 24 }}>
        <Skeletons n={2} />
      </div>
    );
  if (g.error)
    return (
      <div className="page" style={{ paddingTop: 24 }}>
        <ErrorBox error={g.error} />
      </div>
    );
  const { group, leaderboard } = g.data!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      toast("Code copié");
    } catch {
      toast(`Code : ${group.inviteCode}`);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/groupes" className="back">
        <ChevronLeft size={18} aria-hidden /> Groupes
      </Link>
      <div className="page-head">
        <h1>{group.name}</h1>
        <Link to={`/proposer?groupe=${group.id}`} className="btn btn-dark btn-sm">
          <Plus size={18} aria-hidden /> Défi
        </Link>
      </div>

      <div className="panel board">
        <span className="label-c">Code d'invitation</span>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="code">{group.inviteCode}</span>
          <button className="btn btn-ghost btn-sm" onClick={copy}>
            <Copy size={16} aria-hidden /> Copier
          </button>
        </div>
        <span style={{ color: "var(--panel-muted)", fontSize: 14 }}>
          {group.members.length} membre{group.members.length > 1 ? "s" : ""} : {group.members.map((m) => m.username).join(", ")}
        </span>
      </div>

      <section className="section">
        <h2>Classement du groupe</h2>
        <RankList rows={leaderboard} meId={user?.id} />
      </section>

      <section className="section">
        <h2>Défis du groupe</h2>
        <div className="segmented" role="group" aria-label="Défis">
          {(
            [
              ["open", "Ouverts"],
              ["proposed", "En vote"],
              ["done", "Terminés"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {bets.isLoading ? (
            <Skeletons n={1} />
          ) : bets.data?.length ? (
            bets.data.map((b) => (tab === "proposed" ? <ProposalCard key={b.id} bet={b} /> : <BetCard key={b.id} bet={b} />))
          ) : (
            <Empty
              title={tab === "open" ? "Aucun défi ouvert" : tab === "proposed" ? "Rien à voter" : "Pas encore de défi terminé"}
              action={
                tab !== "done" && (
                  <Link to={`/proposer?groupe=${group.id}`} className="btn btn-gold btn-sm">
                    Lancer un défi
                  </Link>
                )
              }
            />
          )}
        </div>
      </section>

      <section className="section">
        {group.isOwner ? (
          <div className="stack">
            <button className="btn btn-ghost" disabled={regen.isPending} onClick={() => regen.mutate(undefined, { onSuccess: () => toast("Nouveau code généré") })}>
              Changer le code d'invitation
            </button>
            <div className="divider-gap" />
            {remove.error && <div className="alert">{remove.error.message}</div>}
            <button
              className="btn btn-danger"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Supprimer le groupe « ${group.name} » ?`)) remove.mutate(undefined, { onSuccess: () => navigate("/groupes") });
              }}
            >
              Supprimer le groupe
            </button>
          </div>
        ) : (
          <button
            className="btn btn-danger btn-block"
            disabled={leave.isPending}
            onClick={() => {
              if (confirm("Quitter ce groupe ?")) leave.mutate(undefined, { onSuccess: () => navigate("/groupes") });
            }}
          >
            Quitter le groupe
          </button>
        )}
      </section>
    </div>
  );
}
