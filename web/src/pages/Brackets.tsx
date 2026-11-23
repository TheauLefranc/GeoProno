import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, type Bracket } from "../lib/api";
import { canManageMatches } from "../lib/categories";
import { categoryPath, coins, countdown } from "../lib/format";
import { useNow } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Empty, ErrorBox, Skeletons } from "../components/States";

type View = "active" | "done";

export function useBrackets(view: View) {
  return useQuery({
    queryKey: ["brackets", view],
    queryFn: () => api<{ brackets: Bracket[] }>(`/brackets?view=${view}`).then((d) => d.brackets),
    refetchInterval: 60_000,
  });
}

export function BracketsPage() {
  const { user } = useSession();
  const [view, setView] = useState<View>("active");
  const q = useBrackets(view);

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/matchs" className="back">
        <ChevronLeft size={18} aria-hidden /> Matchs
      </Link>
      <div className="page-head">
        <h1>Phases finales</h1>
        {canManageMatches(user) && (
          <Link to="/tableaux/nouveau" className="btn btn-dark btn-sm">
            <Plus size={18} aria-hidden /> Créer
          </Link>
        )}
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
        Pronostique tout le tableau, du premier tour à la finale. Plus tu vas loin juste, plus tu prends une grosse part de la cagnotte.
      </p>
      <div className="segmented" role="group" aria-label="Période" style={{ margin: "12px 0" }}>
        <button aria-pressed={view === "active"} onClick={() => setView("active")}>
          En cours
        </button>
        <button aria-pressed={view === "done"} onClick={() => setView("done")}>
          Terminés
        </button>
      </div>

      {q.isLoading ? (
        <Skeletons n={3} h={110} />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <Empty
          title={view === "active" ? "Aucun tableau en cours" : "Pas encore de tableau terminé"}
          action={
            canManageMatches(user) && view === "active" ? (
              <Link to="/tableaux/nouveau" className="btn btn-gold btn-sm">
                Créer un tableau
              </Link>
            ) : undefined
          }
        >
          {view === "active" ? "Les responsables créent ici les tableaux des phases finales : tu pourras pronostiquer tout l'arbre." : null}
        </Empty>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {q.data!.map((b) => (
            <BracketRow key={b.id} bracket={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BracketRow({ bracket: b }: { bracket: Bracket }) {
  const now = useNow(30_000);
  const left = new Date(b.locksAt).getTime() - now;
  const teams = b.participants.filter(Boolean).length;
  return (
    <Link to={`/tableaux/${b.id}`} className="panel match bracket-row" aria-label={b.title}>
      <div className="match-teams">
        <span className="match-name">{b.title}</span>
        <div className="match-meta">
          <span>{categoryPath(b.category)}</span>
          <span>{teams} participants</span>
          <span>
            {b.entryCount} pronostic{b.entryCount > 1 ? "s" : ""} · cagnotte {coins(b.pool)}
          </span>
          {b.state === "OPEN" && left > 0 && <span className="bet-state on">Pronostics ouverts · {countdown(left).toLowerCase()}</span>}
          {b.state === "LOCKED" && <span className="bet-state">En cours</span>}
          {b.state === "SETTLED" && <span className="bet-state">Réglé</span>}
          {b.state === "CANCELLED" && <span className="bet-state">Annulé, remboursé</span>}
          {b.myEntry && (
            <span className="bet-state on">
              {b.state === "SETTLED" ? `${b.myEntry.points} pts · ${b.myEntry.payout ? `+${coins(b.myEntry.payout)}` : "perdu"}` : "Ton tableau est enregistré"}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={18} aria-hidden className="match-chev" />
    </Link>
  );
}
