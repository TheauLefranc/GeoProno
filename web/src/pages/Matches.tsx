import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type Match } from "../lib/api";
import { isStaff, useSession } from "../lib/session";
import { CategoryFilter, type CategoryValue } from "../components/CategoryFilter";
import { MatchRow } from "../components/MatchRow";
import { Empty, ErrorBox, Skeletons } from "../components/States";

type View = "upcoming" | "live" | "results";

export function useMatches(view: View, filter: CategoryValue = {}) {
  const params = new URLSearchParams({ view });
  if (filter.sub) params.set("category", filter.sub);
  else if (filter.main) params.set("main", filter.main);
  return useQuery({
    queryKey: ["matches", view, filter.main ?? "", filter.sub ?? ""],
    queryFn: () => api<{ matches: Match[]; liveCount: number }>(`/matches?${params}`),
    // Live scores refresh on their own.
    refetchInterval: view === "live" ? 10_000 : 60_000,
  });
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const s = dayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupByDay(matches: Match[]) {
  const groups: { day: string; items: Match[] }[] = [];
  for (const m of matches) {
    const day = dayLabel(m.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

export function MatchesPage() {
  const { user } = useSession();
  const [view, setView] = useState<View>("upcoming");
  const [category, setCategory] = useState<CategoryValue>({});
  const q = useMatches(view, category);
  const liveCount = q.data?.liveCount ?? 0;

  const views: { id: View; label: string }[] = [
    { id: "upcoming", label: "À venir" },
    { id: "live", label: liveCount ? `En direct (${liveCount})` : "En direct" },
    { id: "results", label: "Résultats" },
  ];

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <h1>Matchs</h1>
        {isStaff(user) && (
          <Link to="/matchs/nouveau" className="btn btn-dark btn-sm">
            <Plus size={18} aria-hidden /> Ajouter
          </Link>
        )}
      </div>
      <CategoryFilter value={category} onChange={setCategory} />
      <div className="segmented" role="group" aria-label="Période" style={{ margin: "12px 0" }}>
        {views.map((v) => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)} className={v.id === "live" && liveCount ? "has-live" : ""}>
            {v.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Skeletons n={4} h={96} />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : q.data!.matches.length === 0 ? (
        <Empty
          title={view === "upcoming" ? "Aucun match au programme" : view === "live" ? "Aucun match en cours" : "Pas encore de résultats"}
          action={
            isStaff(user) && view === "upcoming" ? (
              <Link to="/matchs/nouveau" className="btn btn-gold btn-sm">
                Ajouter un match
              </Link>
            ) : undefined
          }
        >
          {view === "upcoming"
            ? "Les admins ajoutent ici les matchs à venir. Les paris ouvrent quelques jours avant le coup d'envoi."
            : view === "live"
              ? "Les scores s'affichent ici en direct pendant les matchs."
              : "Les scores finaux des matchs joués apparaîtront ici."}
        </Empty>
      ) : (
        groupByDay(q.data!.matches).map((g) => (
          <section key={g.day} className="day">
            <h2 className="day-head">{g.day}</h2>
            <div className="stack" style={{ gap: 8 }}>
              {g.items.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
