import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Shuffle } from "lucide-react";
import { api, type Bracket } from "../lib/api";
import { BRACKET_SIZES, normalizePicks, roundLabel } from "../lib/bracket";
import { BracketTree } from "../components/BracketTree";
import { canManageCategory, canManageMatches, mainOf, TAXONOMY } from "../lib/categories";
import { useAction } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";

function defaultLock() {
  const d = new Date(Date.now() + 3 * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T18:00`;
}

/** Resizes the slot list, keeping the names already typed. */
const resize = (slots: string[], size: number) => Array.from({ length: size }, (_, i) => slots[i] ?? "");

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Random draw: teams shuffled into the slots, byes given to randomly chosen
 * first-round matches (at most one per match, so nobody meets an empty slot twice).
 */
function drawSlots(teams: string[], size: number): string[] {
  const names = shuffled(teams.map((t) => t.trim()).filter(Boolean));
  const byeMatches = new Set(shuffled(Array.from({ length: size / 2 }, (_, k) => k)).slice(0, size - names.length));
  const out: string[] = [];
  for (let k = 0; k < size / 2; k++) out.push(names.shift()!, byeMatches.has(k) ? "" : names.shift()!);
  return out;
}

export function BracketNewPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const allowed = TAXONOMY.map((m) => ({ ...m, subs: m.subs.filter((s) => canManageCategory(user, s.id)) })).filter((m) => m.subs.length > 0);
  const [category, setCategory] = useState(() => (allowed.some((m) => m.subs.some((s) => s.id === "FOOT")) ? "FOOT" : (allowed[0]?.subs[0]?.id ?? "FOOT")));
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<number>(8);
  const [slots, setSlots] = useState<string[]>(() => resize([], 8));
  const [locksAt, setLocksAt] = useState(defaultLock);
  // "known": the draw already happened, teams are placed match by match.
  // "draw": only the team list is known, the site draws the matches.
  const [mode, setMode] = useState<"known" | "draw">("known");
  const [teams, setTeams] = useState<string[]>(() => resize([], 8));
  const [drawn, setDrawn] = useState<string[] | null>(null);

  const participants = mode === "known" ? slots : drawn;
  const create = useAction(
    () =>
      api<{ bracket: Bracket }>("/brackets", {
        body: { title, category, size, participants, locksAt: new Date(locksAt).toISOString() },
      }),
    [["brackets"]],
  );

  if (!canManageMatches(user)) return <Navigate to="/tableaux" replace />;
  const filled = slots.filter((s) => s.trim()).length;
  const teamCount = teams.filter((t) => t.trim()).length;
  const byes = size - teamCount;
  const setSlot = (i: number, v: string) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));
  const setTeam = (i: number, v: string) => {
    setTeams((s) => s.map((x, j) => (j === i ? v : x)));
    setDrawn(null);
  };
  const ready = mode === "known" ? filled >= 2 : !!drawn;

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/tableaux" className="back">
        <ChevronLeft size={18} aria-hidden /> Phases finales
      </Link>
      <div className="page-head">
        <h1>Créer un tableau</h1>
      </div>
      <form
        className="stack"
        style={{ gap: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined, {
            onSuccess: ({ bracket }) => {
              toast("Tableau créé : les pronostics sont ouverts");
              navigate(`/tableaux/${bracket.id}`);
            },
          });
        }}
      >
        <label className="field">
          <span>Nom du tableau</span>
          <input className="input" required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Phases finales foot inter-écoles" />
        </label>

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

        <div className="field">
          <span>Taille du tableau</span>
          <div className="segmented" role="group" aria-label="Nombre de places">
            {BRACKET_SIZES.map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={size === n}
                onClick={() => {
                  setSize(n);
                  setSlots((s) => resize(s, n));
                  setTeams((s) => resize(s, n));
                  setDrawn(null);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <small>Commence en {roundLabel(size, 0).toLowerCase()}. Laisse une place vide pour un exempt : son adversaire passe directement.</small>
        </div>

        <div className="field">
          <span>Tirage</span>
          <div className="segmented" role="group" aria-label="Tirage">
            <button type="button" aria-pressed={mode === "known"} onClick={() => setMode("known")}>
              Déjà connu
            </button>
            <button type="button" aria-pressed={mode === "draw"} onClick={() => setMode("draw")}>
              Au sort
            </button>
          </div>
          <small>
            {mode === "known"
              ? "Place chaque équipe dans son match du premier tour : le vainqueur du match 1 affronte celui du match 2, et ainsi de suite."
              : "Entre la liste des équipes : le site tire les matchs au sort. Tu vois le résultat avant de valider."}
          </small>
        </div>

        {mode === "draw" ? (
          <div className="field">
            <span>
              Équipes · {teamCount}/{size}
            </span>
            <div className="seed-list">
              {teams.map((t, i) => (
                <input
                  key={i}
                  className="input"
                  maxLength={40}
                  value={t}
                  onChange={(e) => setTeam(i, e.target.value)}
                  placeholder={`Équipe ${i + 1}`}
                  aria-label={`Équipe ${i + 1}`}
                />
              ))}
            </div>
            {byes > size / 2 ? (
              <small>Trop peu d'équipes pour un tableau de {size} : choisis une taille plus petite.</small>
            ) : (
              <>
                {byes > 0 && teamCount >= 2 && (
                  <small>
                    {byes} exempt{byes > 1 ? "s" : ""} tiré{byes > 1 ? "s" : ""} au sort : ces équipes passent directement au tour suivant.
                  </small>
                )}
                <button
                  type="button"
                  className="btn btn-dark btn-block"
                  disabled={teamCount < 2}
                  onClick={() => setDrawn(drawSlots(teams, size))}
                >
                  <Shuffle size={18} aria-hidden /> {drawn ? "Refaire le tirage" : "Tirer au sort"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="field">
            <span>
              Participants · {filled}/{size}
            </span>
            <div className="seed-list">
              {Array.from({ length: size / 2 }, (_, k) => (
                <fieldset key={k} className="seed-pair">
                  <legend className="label-c">Match {k + 1}</legend>
                  {[2 * k, 2 * k + 1].map((i) => (
                    <input
                      key={i}
                      className="input"
                      maxLength={40}
                      value={slots[i]}
                      onChange={(e) => setSlot(i, e.target.value)}
                      placeholder={`Place ${i + 1} (vide = exempt)`}
                      aria-label={`Match ${k + 1}, place ${i + 1}`}
                    />
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
        )}

        {participants && participants.filter((p) => p.trim()).length >= 2 && (
          <section className="panel board" aria-label="Aperçu du tableau">
            <span className="label-c">{mode === "draw" ? "Résultat du tirage" : "Aperçu du tableau"}</span>
            <BracketTree
              size={size}
              participants={participants.map((p) => p.trim())}
              values={normalizePicks(size, participants.map((p) => p.trim()), [])}
              label="Aperçu du tableau"
            />
          </section>
        )}

        <label className="field">
          <span>Fin des pronostics</span>
          <input className="input" type="datetime-local" required value={locksAt} onChange={(e) => setLocksAt(e.target.value)} />
          <small>Mets l'heure du premier match. Saisir un premier résultat ferme aussi les pronostics.</small>
        </label>

        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
          Cagnotte : chaque bon pronostic rapporte des points, qui doublent à chaque tour. À la finale, toutes les mises sont partagées au prorata mise ×
          points.
          {!(user?.role === "ADMIN" || user?.role === "MODERATOR") && " En tant que responsable de ce sport, tu ne pourras pas jouer ce tableau."}
        </p>

        {create.error && (
          <div className="alert" role="alert">
            {create.error.message}
          </div>
        )}
        <button className="btn btn-gold btn-block" disabled={create.isPending || !ready}>
          {create.isPending ? <Spinner /> : mode === "draw" && !drawn ? "Fais d'abord le tirage" : "Créer le tableau"}
        </button>
      </form>
    </div>
  );
}
