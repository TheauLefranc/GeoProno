import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Minus, Plus } from "lucide-react";
import { api, type Bet, type Match } from "../lib/api";
import { categoryPath, countdown, when } from "../lib/format";
import { useAction, useNow } from "../lib/hooks";
import { isStaff, useSession } from "../lib/session";
import { BetCard } from "../components/BetCard";
import { Led } from "../components/Led";
import { ErrorBox, Skeletons, Spinner } from "../components/States";
import { useToast } from "../components/Toast";

export function MatchPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["match", id],
    queryFn: () => api<{ match: Match }>(`/matches/${id}`).then((d) => d.match),
    refetchInterval: (query) => (query.state.data?.status === "LIVE" ? 8_000 : 60_000),
  });
  const m = q.data;
  const bet = useQuery({
    queryKey: ["bet", m?.bet?.id],
    queryFn: () => api<{ bet: Bet }>(`/bets/${m!.bet!.id}`).then((d) => d.bet),
    enabled: !!m?.bet,
  });

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/matchs" className="back">
        <ChevronLeft size={18} aria-hidden /> Matchs
      </Link>
      <div style={{ height: 16 }} />
      {q.isLoading ? (
        <Skeletons n={1} h={240} />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <Scoreboard match={m!} />
          {isStaff(user) && <MatchControls match={m!} />}
          {m!.bet && bet.data && <BetCard bet={bet.data} inMatch />}
          {!m!.bet && <p style={{ color: "var(--ink-2)" }}>Pas de pari sur ce match.</p>}
        </div>
      )}
    </div>
  );
}

function Scoreboard({ match: m }: { match: Match }) {
  const now = useNow(1000);
  const toStart = new Date(m.startsAt).getTime() - now;
  const showScore = m.status === "LIVE" || m.status === "FINISHED";
  return (
    <section className="panel board scoreboard" aria-label="Tableau du match">
      <div className="board-strip">
        <span className="label-c">{categoryPath(m.category)}</span>
        {m.status === "LIVE" && <span className="live-dot">Direct</span>}
        {m.status === "FINISHED" && <span className="stamp gold">Terminé</span>}
        {m.status === "CANCELLED" && <span className="stamp red">Annulé</span>}
        {m.status === "SCHEDULED" && toStart > 0 && (
          <div className="clock">
            <span className="label-c">Coup d'envoi dans</span>
            <Led value={countdown(toStart)} />
          </div>
        )}
      </div>
      <div className="sb-grid">
        <span className="sb-name">{m.homeName}</span>
        <span className="sb-sep" aria-hidden />
        <span className="sb-name">{m.awayName}</span>
        <Led value={showScore ? String(m.homeScore) : "–"} className="sb-score" label={`${m.homeName} : ${m.homeScore}`} />
        <span className="sb-colon" aria-hidden>
          <i />
          <i />
        </span>
        <Led value={showScore ? String(m.awayScore) : "–"} className="sb-score" label={`${m.awayName} : ${m.awayScore}`} />
      </div>
      {m.liveNote && m.status === "LIVE" && <p className="sb-note">{m.liveNote}</p>}
      <div className="pool-row">
        <span>{when(m.startsAt)}</span>
        {m.location && (
          <span>
            <MapPin size={12} aria-hidden /> {m.location}
          </span>
        )}
      </div>
    </section>
  );
}

/** Staff-only: kick-off, live score taps, final whistle (settles the bet), cancel. */
function MatchControls({ match: m }: { match: Match }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [home, setHome] = useState(m.homeScore);
  const [away, setAway] = useState(m.awayScore);
  const [note, setNote] = useState(m.liveNote ?? "");
  const active = m.status === "SCHEDULED" || m.status === "LIVE";

  useEffect(() => {
    setHome(m.homeScore);
    setAway(m.awayScore);
  }, [m.homeScore, m.awayScore]);

  const refresh = [["match", m.id], ["matches"]];
  const score = useAction(
    (v: { homeScore: number; awayScore: number; liveNote?: string | null; live?: boolean }) => api(`/matches/${m.id}/score`, { body: v }),
    refresh,
  );
  const finish = useAction(
    () => api<{ settled: boolean; refunded?: boolean }>(`/matches/${m.id}/finish`, { body: { homeScore: home, awayScore: away } }),
    refresh,
  );
  const cancel = useAction(() => api(`/matches/${m.id}/cancel`, { method: "POST" }), refresh);
  const error = score.error || finish.error || cancel.error;

  // Each tap is sent immediately: live scoring must be one thumb, no save button.
  const bump = (side: "home" | "away", delta: number) => {
    const h = side === "home" ? Math.max(0, home + delta) : home;
    const a = side === "away" ? Math.max(0, away + delta) : away;
    setHome(h);
    setAway(a);
    if (m.status === "LIVE") score.mutate({ homeScore: h, awayScore: a });
  };

  if (!active) return null;
  return (
    <section className="panel board" aria-label="Gestion du match">
      <h2 style={{ font: "700 20px/1.2 var(--font-c)" }}>Gestion du match</h2>
      {error && <div className="alert">{error.message}</div>}

      <div className="stepper-grid">
        {(
          [
            ["home", m.homeName, home],
            ["away", m.awayName, away],
          ] as const
        ).map(([side, name, val]) => (
          <div key={side} className="stepper">
            <span className="side-name">{name}</span>
            <div className="row" style={{ justifyContent: "center", gap: 6 }}>
              <button className="step-btn" onClick={() => bump(side, -1)} aria-label={`Retirer un point à ${name}`} disabled={val === 0}>
                <Minus size={20} />
              </button>
              <Led value={String(val)} className="step-val" />
              <button className="step-btn" onClick={() => bump(side, +1)} aria-label={`Ajouter un point à ${name}`}>
                <Plus size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {m.status === "LIVE" && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            score.mutate({ homeScore: home, awayScore: away, liveNote: note || null }, { onSuccess: () => toast("Info du match mise à jour") });
          }}
        >
          <input
            className="input grow"
            style={{ background: "var(--panel-2)", borderColor: "var(--panel-line)", color: "var(--panel-text)" }}
            placeholder="2e mi-temps, Set 3, Prolongations…"
            maxLength={40}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Info en direct"
          />
          <button className="btn btn-ghost btn-sm" disabled={score.isPending}>
            Afficher
          </button>
        </form>
      )}

      {m.status === "SCHEDULED" ? (
        <button
          className="btn btn-blue btn-block"
          disabled={score.isPending}
          onClick={() => score.mutate({ homeScore: home, awayScore: away, live: true }, { onSuccess: () => toast("Match lancé, paris fermés") })}
        >
          Lancer le match (ferme les paris)
        </button>
      ) : (
        <>
          <div className="divider-gap" />
          <button
            className="btn btn-gold btn-block"
            disabled={finish.isPending}
            onClick={() => {
              if (!confirm(`Score final ${m.homeName} ${home} – ${away} ${m.awayName} ?${m.bet ? " Le pari sera réglé automatiquement." : ""}`)) return;
              finish.mutate(undefined, {
                onSuccess: (r) => {
                  qc.invalidateQueries({ queryKey: ["bet"] });
                  toast(r.refunded ? "Match terminé : nul sans option nul, mises remboursées" : r.settled ? "Match terminé, gains versés" : "Match terminé");
                },
              });
            }}
          >
            {finish.isPending ? <Spinner /> : `Terminer : ${home} – ${away}`}
          </button>
          <small style={{ color: "var(--panel-muted)", textAlign: "center" }}>Irréversible : le pari est réglé avec ce score.</small>
        </>
      )}

      <div style={{ borderTop: "1px dashed var(--panel-line)", paddingTop: 16, marginTop: 8 }}>
        <button
          className="btn btn-danger btn-block"
          disabled={cancel.isPending}
          onClick={() => {
            if (confirm("Annuler ce match ? Les mises seront remboursées.")) cancel.mutate(undefined, { onSuccess: () => toast("Match annulé, mises remboursées") });
          }}
        >
          Annuler le match
        </button>
      </div>
    </section>
  );
}
