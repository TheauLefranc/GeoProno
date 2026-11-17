import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type Bet } from "../lib/api";
import { CATEGORIES } from "../lib/format";
import { BetCard } from "../components/BetCard";
import { Empty, ErrorBox, Skeletons } from "../components/States";

type View = "open" | "awaiting" | "done";
const VIEWS: { id: View; label: string }[] = [
  { id: "open", label: "Ouverts" },
  { id: "awaiting", label: "En attente" },
  { id: "done", label: "Terminés" },
];

export function useBets(view: string, category?: string, groupId?: string) {
  const params = new URLSearchParams({ view });
  if (category) params.set("category", category);
  if (groupId) params.set("groupId", groupId);
  return useQuery({
    queryKey: ["bets", view, category ?? "", groupId ?? ""],
    queryFn: () => api<{ bets: Bet[] }>(`/bets?${params}`).then((d) => d.bets),
    refetchInterval: view === "open" ? 20_000 : false,
  });
}

export function FeedPage() {
  const [view, setView] = useState<View>("open");
  const [category, setCategory] = useState<string | undefined>();
  const bets = useBets(view, category);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Paris</h1>
        <Link to="/proposer" className="btn btn-dark btn-sm">
          <Plus size={18} aria-hidden /> Proposer
        </Link>
      </div>
      <div className="segmented" role="group" aria-label="État des paris">
        {VIEWS.map((v) => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="rail" role="group" aria-label="Sport">
        <button className="chip" aria-pressed={!category} onClick={() => setCategory(undefined)}>
          Tout
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

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
            {category ? "Rien dans ce sport pour l'instant. " : ""}Un pari ouvre dès qu'il a assez de votes : va donner un coup de pouce aux
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
