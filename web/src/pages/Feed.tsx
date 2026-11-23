import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Trophy } from "lucide-react";
import { useBrackets } from "./Brackets";
import { api, type Bet } from "../lib/api";
import { BetCard } from "../components/BetCard";
import { CategoryFilter, type CategoryValue } from "../components/CategoryFilter";
import { Empty, ErrorBox, Skeletons } from "../components/States";

type View = "open" | "awaiting" | "done";
const VIEWS: { id: View; label: string }[] = [
  { id: "open", label: "Ouverts" },
  { id: "awaiting", label: "En attente" },
  { id: "done", label: "Terminés" },
];

export function useBets(view: string, filter: CategoryValue = {}, groupId?: string) {
  const params = new URLSearchParams({ view });
  if (filter.sub) params.set("category", filter.sub);
  else if (filter.main) params.set("main", filter.main);
  if (groupId) params.set("groupId", groupId);
  return useQuery({
    queryKey: ["bets", view, filter.main ?? "", filter.sub ?? "", groupId ?? ""],
    queryFn: () => api<{ bets: Bet[] }>(`/bets?${params}`).then((d) => d.bets),
    refetchInterval: view === "open" ? 20_000 : false,
  });
}

/** Brackets still taking predictions: they are not bets of the feed, so they get a strip of their own. */
function OpenBrackets() {
  const q = useBrackets("active");
  const open = (q.data ?? []).filter((b) => b.state === "OPEN");
  if (!open.length) return null;
  return (
    <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
      {open.map((b) => (
        <Link key={b.id} to={`/tableaux/${b.id}`} className="panel bracket-teaser">
          <Trophy size={20} aria-hidden />
          <span className="grow">
            <strong>{b.title}</strong>
            <small>{b.myEntry ? "Ton tableau est enregistré · modifiable jusqu'au début" : "Pronostique tout le tableau des phases finales"}</small>
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      ))}
    </div>
  );
}

export function FeedPage() {
  const [view, setView] = useState<View>("open");
  const [category, setCategory] = useState<CategoryValue>({});
  const bets = useBets(view, category);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Paris</h1>
        <Link to="/proposer" className="btn btn-dark btn-sm">
          <Plus size={18} aria-hidden /> Proposer
        </Link>
      </div>
      <CategoryFilter value={category} onChange={setCategory} />
      <div className="segmented" role="group" aria-label="État des paris" style={{ margin: "12px 0" }}>
        {VIEWS.map((v) => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {view === "open" && <OpenBrackets />}

      {bets.isLoading ? (
        <Skeletons />
      ) : bets.error ? (
        <ErrorBox error={bets.error} retry={() => bets.refetch()} />
      ) : bets.data!.length === 0 ? (
        view === "open" ? (
          <Empty
            title="Aucun pari ouvert"
            action={
              <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <Link to="/votes" className="btn btn-dark btn-sm">
                  Voter les propositions
                </Link>
                <Link to="/proposer" className="btn btn-ghost btn-sm">
                  Proposer un pari
                </Link>
              </div>
            }
          >
            {category.main ? "Rien dans cette catégorie pour l'instant. " : ""}Un pari ouvre dès qu'il a assez de votes : va donner un coup de pouce aux
            propositions.
          </Empty>
        ) : view === "awaiting" ? (
          <Empty title="Rien en attente">Les paris dont les mises sont fermées apparaissent ici jusqu'à la saisie du résultat.</Empty>
        ) : (
          <Empty title="Pas encore d'historique">Les paris réglés et annulés s'afficheront ici.</Empty>
        )
      ) : (
        <div className="stack">
          {bets.data!.map((b) => (
            <BetCard key={b.id} bet={b} />
          ))}
        </div>
      )}
    </div>
  );
}
