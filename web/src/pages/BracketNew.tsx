import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Shuffle } from "lucide-react";
import { api, type Bracket } from "../lib/api";
import { BRACKET_SIZES, roundLabel } from "../lib/bracket";
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

  const create = useAction(
    () =>
      api<{ bracket: Bracket }>("/brackets", {
        body: { title, category, size, participants: slots, locksAt: new Date(locksAt).toISOString() },
      }),
    [["brackets"]],
  );

  if (!canManageMatches(user)) return <Navigate to="/tableaux" replace />;
  const filled = slots.filter((s) => s.trim()).length;
  const setSlot = (i: number, v: string) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));
  // Shuffles the names over the filled places only: byes stay where they were put.
  const shuffle = () =>
    setSlots((s) => {
      const names = s.filter((x) => x.trim());
      for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
      }
      let n = 0;
      return s.map((x) => (x.trim() ? names[n++] : ""));
    });

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
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <small>Commence en {roundLabel(size, 0).toLowerCase()}. Laisse une place vide pour un exempt : son adversaire passe directement.</small>
        </div>

        <div className="field">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              Participants · {filled}/{size}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={shuffle} disabled={filled < 2}>
              <Shuffle size={16} aria-hidden /> Tirage au sort
            </button>
          </div>
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
        <button className="btn btn-gold btn-block" disabled={create.isPending || filled < 2}>
          {create.isPending ? <Spinner /> : "Créer le tableau"}
        </button>
      </form>
    </div>
  );
}
