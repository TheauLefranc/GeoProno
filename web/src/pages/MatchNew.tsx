import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api, type Match } from "../lib/api";
import { canManageCategory, canManageMatches, mainOf, TAXONOMY } from "../lib/categories";
import { when } from "../lib/format";
import { useAction, usePublicConfig } from "../lib/hooks";
import { isStaff, useSession } from "../lib/session";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";

function defaultStart() {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(18, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T18:00`;
}

export function MatchNewPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const cfg = usePublicConfig();
  // Sport managers only see the categories they run; staff see everything.
  const allowed = TAXONOMY.map((m) => ({ ...m, subs: m.subs.filter((s) => canManageCategory(user, s.id)) })).filter((m) => m.subs.length > 0);
  const staff = isStaff(user);
  const [category, setCategory] = useState(() => (allowed.some((m) => m.subs.some((s) => s.id === "FOOT")) ? "FOOT" : (allowed[0]?.subs[0]?.id ?? "FOOT")));
  const [homeName, setHome] = useState("");
  const [awayName, setAway] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [withBet, setWithBet] = useState(true);
  const [allowDraw, setAllowDraw] = useState(false);
  const [oddsEnabled, setOddsEnabled] = useState(false);
  const [odds, setOdds] = useState({ home: "", draw: "", away: "" });

  const create = useAction(
    () =>
      api<{ match: Match }>("/matches", {
        body: {
          category,
          homeName,
          awayName,
          location: location || undefined,
          startsAt: new Date(startsAt).toISOString(),
          withBet,
          allowDraw,
          oddsEnabled: withBet && oddsEnabled && staff,
          odds:
            withBet && oddsEnabled && staff
              ? {
                  home: Number(odds.home.replace(",", ".")) || undefined,
                  draw: allowDraw ? Number(odds.draw.replace(",", ".")) || undefined : undefined,
                  away: Number(odds.away.replace(",", ".")) || undefined,
                }
              : undefined,
        },
      }),
    [["matches"]],
  );

  if (!canManageMatches(user)) return <Navigate to="/matchs" replace />;
  const days = cfg.data?.betOpenDays ?? 5;
  const start = new Date(startsAt);
  const opens = new Date(Math.max(Date.now(), start.getTime() - days * 86_400_000));
  const oddsInput = (k: "home" | "draw" | "away", label: string) => (
    <label className="field" style={{ flex: 1 }}>
      <span>{label}</span>
      <input
        className="input"
        inputMode="decimal"
        required
        placeholder="1.80"
        value={odds[k]}
        onChange={(e) => setOdds((o) => ({ ...o, [k]: e.target.value.replace(/[^0-9.,]/g, "") }))}
      />
    </label>
  );

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/matchs" className="back">
        <ChevronLeft size={18} aria-hidden /> Matchs
      </Link>
      <div className="page-head">
        <h1>Ajouter un match</h1>
      </div>
      <form
        className="stack"
        style={{ gap: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined, {
            onSuccess: ({ match }) => {
              toast("Match ajouté au programme");
              navigate(`/matchs/${match.id}`);
            },
          });
        }}
      >
        <div className="field">
          <span>Catégorie</span>
          <div className="rail" style={{ paddingTop: 0, paddingBottom: 0 }} role="group" aria-label="Catégorie principale">
            {allowed.map((m) => (
              <button type="button" key={m.id} className="chip" aria-pressed={mainOf(category)?.id === m.id} onClick={() => setCategory(m.subs[0].id)}>
                {m.label}
              </button>
            ))}
          </div>
          {(allowed.find((m) => m.id === mainOf(category)?.id)?.subs.length ?? 0) > 1 && (
            <div className="rail" style={{ paddingTop: 4, paddingBottom: 0 }} role="group" aria-label="Sous-catégorie">
              {allowed.find((m) => m.id === mainOf(category)?.id)!.subs.map((s) => (
                <button type="button" key={s.id} className="chip chip-sub" aria-pressed={category === s.id} onClick={() => setCategory(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row" style={{ alignItems: "end" }}>
          <label className="field grow">
            <span>Équipe A</span>
            <input className="input" required maxLength={40} value={homeName} onChange={(e) => setHome(e.target.value)} placeholder="Géo" />
          </label>
          <span style={{ paddingBottom: 14, fontWeight: 700, color: "var(--ink-3)" }}>contre</span>
          <label className="field grow">
            <span>Équipe B</span>
            <input className="input" required maxLength={40} value={awayName} onChange={(e) => setAway(e.target.value)} placeholder="Mines" />
          </label>
        </div>

        <label className="field">
          <span>Coup d'envoi</span>
          <input className="input" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>

        <label className="field">
          <span>Lieu (facultatif)</span>
          <input className="input" maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Gymnase, Foyer, Stade universitaire…" />
        </label>

        <label className="switch">
          <span>
            Ouvrir un pari sur ce match
            <small>
              {withBet && !isNaN(start.getTime())
                ? `Les paris ouvriront ${opens.getTime() <= Date.now() + 60_000 ? "tout de suite" : `le ${when(opens.toISOString())}`} (${days} jours avant) et fermeront au coup d'envoi. Pas besoin de votes.`
                : "Le match apparaîtra seulement au programme."}
            </small>
          </span>
          <input type="checkbox" checked={withBet} onChange={(e) => setWithBet(e.target.checked)} />
        </label>

        {withBet && (
          <>
            <label className="switch">
              <span>
                Le match nul est possible
                <small>Ajoute l'issue « Match nul ». Sinon, un nul rembourse toutes les mises.</small>
              </span>
              <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
            </label>
            {staff ? (
              <label className="switch">
                <span>
                  Cotes fixes
                  <small>{oddsEnabled ? "Gain = mise × cote." : "Désactivé : la cagnotte est partagée entre les gagnants."}</small>
                </span>
                <input
                  type="checkbox"
                  checked={oddsEnabled}
                  disabled={cfg.data?.oddsFeatureEnabled === false}
                  onChange={(e) => setOddsEnabled(e.target.checked)}
                />
              </label>
            ) : (
              <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
                Pari en cagnotte : les gagnants se partagent les mises. Les cotes fixes sont réservées aux admins et modérateurs.
              </p>
            )}
            {staff && oddsEnabled && (
              <div className="row" style={{ alignItems: "end" }}>
                {oddsInput("home", homeName || "Équipe A")}
                {allowDraw && oddsInput("draw", "Nul")}
                {oddsInput("away", awayName || "Équipe B")}
              </div>
            )}
          </>
        )}

        {create.error && (
          <div className="alert" role="alert">
            {create.error.message}
          </div>
        )}
        <button className="btn btn-gold btn-block" disabled={create.isPending}>
          {create.isPending ? <Spinner /> : "Ajouter au programme"}
        </button>
      </form>
    </div>
  );
}
