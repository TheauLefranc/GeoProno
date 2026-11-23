import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api, type Bracket } from "../lib/api";
import { BYE, decisions, entrants, isByeMatch, normalizePicks, parentOf, roundLabel, roundOf } from "../lib/bracket";
import { categoryPath, coins, countdown, CURRENCY, when } from "../lib/format";
import { useAction, useNow, usePublicConfig } from "../lib/hooks";
import { useSession } from "../lib/session";
import { BracketTree } from "../components/BracketTree";
import { Led } from "../components/Led";
import { ErrorBox, Skeletons, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { WagerPill } from "./Bet";

export function BracketPage() {
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: ["bracket", id],
    queryFn: () => api<{ bracket: Bracket }>(`/brackets/${id}`).then((d) => d.bracket),
    refetchInterval: (query) => (query.state.data?.state === "LOCKED" ? 15_000 : 60_000),
  });
  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/tableaux" className="back">
        <ChevronLeft size={18} aria-hidden /> Phases finales
      </Link>
      <div style={{ height: 16 }} />
      {q.isLoading ? <Skeletons n={2} h={240} /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : <BracketDetail b={q.data!} />}
    </div>
  );
}

function BracketDetail({ b }: { b: Bracket }) {
  const open = b.state === "OPEN";
  const canPredict = open && b.canEnter;
  const showResults = !open || b.canManage;
  const [view, setView] = useState<"picks" | "results">(canPredict ? "picks" : "results");
  // Results view: whose prediction is compared with the real outcomes.
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const compared = compareWith ? b.standings?.find((s) => s.userId === compareWith) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Header b={b} />
      {canPredict && showResults && (
        <div className="segmented" role="group" aria-label="Affichage">
          <button aria-pressed={view === "picks"} onClick={() => setView("picks")}>
            Mon pronostic
          </button>
          <button aria-pressed={view === "results"} onClick={() => setView("results")}>
            Résultats
          </button>
        </div>
      )}
      {canPredict && view === "picks" ? (
        <Predict b={b} />
      ) : showResults ? (
        <Results b={b} compare={compared ? { name: compared.username, picks: compared.picks } : null} onReset={() => setCompareWith(null)} />
      ) : (
        <section className="panel board">
          <BracketTree size={b.size} participants={b.participants} values={b.outcomes} label="Tableau" />
          <p style={{ color: "var(--panel-muted)", fontSize: 14 }}>
            Tu gères ce sport : tu ne peux pas pronostiquer ce tableau.
          </p>
        </section>
      )}
      {b.canManage && <Manage b={b} />}
      {b.standings && <Standings b={b} selected={compareWith} onSelect={(u) => setCompareWith(u)} />}
    </div>
  );
}

function Header({ b }: { b: Bracket }) {
  const now = useNow(1000);
  const left = new Date(b.locksAt).getTime() - now;
  return (
    <section className="panel board" aria-label="Tableau">
      <div className="board-strip">
        <span className="label-c">{categoryPath(b.category)}</span>
        {b.state === "OPEN" && left > 0 && (
          <div className={`clock${left < 3600_000 ? " soon" : ""}`}>
            <span className="label-c">Pronostics jusqu'à</span>
            <Led value={countdown(left)} />
          </div>
        )}
        {b.state === "LOCKED" && <span className="live-dot">En cours</span>}
        {b.state === "SETTLED" && <span className="stamp gold">Réglé</span>}
        {b.state === "CANCELLED" && <span className="stamp red">Annulé</span>}
      </div>
      <h1 className="board-title" style={{ fontSize: 22 }}>
        {b.title}
      </h1>
      <div className="pool-row">
        <span>
          Cagnotte <strong>{coins(b.pool)}</strong>
        </span>
        <span>
          <strong>{b.entryCount}</strong> pronostic{b.entryCount > 1 ? "s" : ""}
        </span>
        <span>
          Max <strong>{b.maxPoints} pts</strong>
        </span>
      </div>
      {b.myEntry && (
        <div className="pool-row">
          <span>
            Ta mise <strong>{coins(b.myEntry.amount)}</strong>
          </span>
          {b.state !== "OPEN" && (
            <span>
              Tes points <strong style={{ color: "var(--gold)" }}>{b.myEntry.points}</strong>
            </span>
          )}
          {b.state === "SETTLED" && <WagerPill status={b.myEntry.status} payout={b.myEntry.payout} />}
          {b.state === "CANCELLED" && <span>Remboursée</span>}
        </div>
      )}
    </section>
  );
}

/** Pick a winner for every match; picks further up follow, the stake is set on the first save. */
function Predict({ b }: { b: Bracket }) {
  const { user } = useSession();
  const cfg = usePublicConfig();
  const toast = useToast();
  const saved = b.myEntry?.picks ?? null;
  const [picks, setPicks] = useState<(number | null)[]>(() => normalizePicks(b.size, b.participants, saved ?? []));
  const [amount, setAmount] = useState("10");
  // A participant rename keeps the slots; a new bye layout re-normalises the draft.
  useEffect(() => setPicks((p) => normalizePicks(b.size, b.participants, p)), [b.size, b.participants]);

  const save = useAction(
    (v: { picks: number[]; amount?: number }) => api<{ created: boolean }>(`/brackets/${b.id}/entry`, { method: "PUT", body: v }),
    [["bracket", b.id], ["brackets"]],
  );

  const total = decisions(b.size, b.participants);
  const done = picks.filter((p, i) => p !== null && !isByeMatch(b.size, b.participants, i)).length;
  const complete = picks.every((p) => p !== null);
  const dirty = !saved || saved.some((p, i) => p !== picks[i]);
  const stake = Number(amount) || 0;
  const balance = user?.balance ?? 0;
  const maxStake = Math.max(0, Math.min(balance, cfg.data?.maxStake ?? balance));
  const champion = picks[b.size - 2];

  // First empty match of the earliest round still open: where the eye should go next.
  const nextRound = useMemo(() => {
    const i = picks.findIndex((p) => p === null);
    return i < 0 ? null : roundLabel(b.size, roundOf(b.size, i));
  }, [picks, b.size]);

  const pick = (match: number, slot: number) => setPicks((p) => normalizePicks(b.size, b.participants, p.map((x, i) => (i === match ? slot : x))));

  return (
    <section className="panel board" aria-label="Ton pronostic">
      <div className="board-strip">
        <span className="label-c">
          Ton pronostic · {done}/{total}
        </span>
        {done > 0 && !b.myEntry && (
          <button className="link-btn" onClick={() => setPicks(normalizePicks(b.size, b.participants, []))}>
            Tout effacer
          </button>
        )}
      </div>
      <BracketTree size={b.size} participants={b.participants} values={picks} onPick={pick} label="Ton pronostic, touche le vainqueur de chaque match" />
      <p className="tap-hint">{complete ? `Ton champion : ${b.participants[champion!]}` : `Touche le vainqueur de chaque match${nextRound ? ` · ${nextRound}` : ""}`}</p>

      <form
        className="stake"
        onSubmit={(e) => {
          e.preventDefault();
          if (!complete) return;
          save.mutate(
            { picks: picks as number[], amount: b.myEntry ? undefined : stake },
            { onSuccess: (r) => toast(r.created ? `Tableau validé, ${coins(stake)} ${CURRENCY} misés` : "Pronostic mis à jour") },
          );
        }}
      >
        {!b.myEntry ? (
          <>
            <label className="stake-input">
              <span className="label-c">Mise</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
                aria-label="Mise sur ton tableau"
              />
            </label>
            <div className="quick">
              {[10, 25, 50].map((v) => (
                <button type="button" key={v} onClick={() => setAmount(String(Math.min(v, maxStake || v)))}>
                  {v}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(String(maxStake))}>
                Tout
              </button>
            </div>
            <small style={{ color: "var(--panel-muted)", fontSize: 12 }}>
              Chaque bon pronostic rapporte des points (ils doublent à chaque tour). Après la finale, la cagnotte est partagée au prorata mise × points.
              Tu pourras modifier tes choix jusqu'à {when(b.locksAt)}, pas ta mise.
            </small>
            {stake > balance && <div className="alert">Solde insuffisant : tu as {coins(balance)} {CURRENCY}.</div>}
          </>
        ) : (
          <small style={{ color: "var(--panel-muted)", fontSize: 12 }}>Ta mise de {coins(b.myEntry.amount)} est engagée. Tu peux encore changer tes choix jusqu'à {when(b.locksAt)}.</small>
        )}
        {save.error && <div className="alert">{save.error.message}</div>}
        <button
          className="btn btn-gold btn-block"
          disabled={save.isPending || !complete || !dirty || (!b.myEntry && (stake <= 0 || stake > balance))}
        >
          {save.isPending ? (
            <Spinner />
          ) : !complete ? (
            `Encore ${total - done} match${total - done > 1 ? "s" : ""} à choisir`
          ) : b.myEntry ? (
            dirty ? "Enregistrer mes changements" : "Pronostic enregistré"
          ) : (
            `Valider mon tableau · ${coins(stake)}`
          )}
        </button>
      </form>
    </section>
  );
}

/** Real results. Managers tap an entrant to record the winner of a match. */
function Results({ b, compare, onReset }: { b: Bracket; compare: { name: string; picks: number[] } | null; onReset: () => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState<{ match: number; winner: number } | null>(null);
  const [score, setScore] = useState("");
  const editable = b.canManage && (b.state === "OPEN" || b.state === "LOCKED");
  const mine = b.myEntry?.picks ?? null;
  const shown = compare ?? (mine ? { name: "toi", picks: mine } : null);

  const result = useAction(
    (v: { match: number; winner: number | null; score?: string | null }) =>
      api<{ settled: boolean }>(`/brackets/${b.id}/results`, { body: v }),
    [["bracket", b.id], ["brackets"]],
  );

  const canEdit = (i: number) => {
    if (!editable || isByeMatch(b.size, b.participants, i)) return false;
    const [x, y] = entrants(b.size, b.participants, b.outcomes, i);
    const parent = parentOf(b.size, i);
    return x !== null && y !== null && x !== BYE && y !== BYE && (parent === null || b.outcomes[parent] === null);
  };

  const submit = (winner: number | null) => {
    if (!selected) return;
    const final = parentOf(b.size, selected.match) === null;
    if (winner !== null && final && !confirm(`${b.participants[winner]} remporte la finale ? Le tableau sera réglé et les gains versés.`)) return;
    result.mutate(
      { match: selected.match, winner, score: winner === null ? null : score || null },
      {
        onSuccess: (r) => {
          setSelected(null);
          toast(r.settled ? "Finale saisie : gains versés" : winner === null ? "Résultat effacé" : "Résultat enregistré");
        },
      },
    );
  };

  const sel = selected ? entrants(b.size, b.participants, b.outcomes, selected.match) : null;
  return (
    <section className="panel board" aria-label="Résultats">
      <div className="board-strip">
        <span className="label-c">Résultats{shown ? ` · comparés avec ${shown.name}` : ""}</span>
        {compare && (
          <button className="link-btn" onClick={onReset}>
            {mine ? "Revenir à moi" : "Masquer"}
          </button>
        )}
      </div>
      <BracketTree
        size={b.size}
        participants={b.participants}
        values={b.outcomes}
        scores={b.scores}
        compare={shown?.picks}
        onPick={editable ? (match, slot) => {
          setSelected({ match, winner: slot });
          setScore(b.scores[match] ?? "");
        } : undefined}
        clickable={canEdit}
        selected={selected?.match ?? null}
        label="Résultats du tableau"
      />
      {editable && !selected && <p className="tap-hint">Touche le vainqueur d'un match pour saisir son résultat</p>}
      {b.state === "OPEN" && editable && (
        <small style={{ color: "var(--panel-muted)", fontSize: 12 }}>Saisir un premier résultat ferme les pronostics.</small>
      )}

      {selected && sel && (
        <div className="stake">
          <span className="label-c">
            {roundLabel(b.size, roundOf(b.size, selected.match))} · {b.participants[sel[0]!]} contre {b.participants[sel[1]!]}
          </span>
          <div className="sides">
            {sel.map((slot) => (
              <button
                key={slot}
                type="button"
                className="side"
                aria-pressed={selected.winner === slot}
                onClick={() => setSelected({ ...selected, winner: slot! })}
              >
                <span className="side-name">{b.participants[slot!]}</span>
                <span className="side-sub">{selected.winner === slot ? "Vainqueur" : "Choisir"}</span>
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ background: "var(--panel-2)", borderColor: "var(--panel-line)", color: "var(--panel-text)" }}
            placeholder="Score (facultatif) : 3-1, 2 sets à 0…"
            maxLength={20}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            aria-label="Score du match"
          />
          {result.error && <div className="alert">{result.error.message}</div>}
          <div className="stake-actions">
            <button className="btn btn-gold btn-block" disabled={result.isPending} onClick={() => submit(selected.winner)}>
              {result.isPending ? <Spinner /> : `Valider : ${b.participants[selected.winner]} gagne`}
            </button>
            <div className="row" style={{ justifyContent: "center", gap: 20 }}>
              {b.outcomes[selected.match] !== null && (
                <button type="button" className="link-btn" onClick={() => submit(null)} disabled={result.isPending}>
                  Effacer ce résultat
                </button>
              )}
              <button type="button" className="link-btn" onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Standings({ b, selected, onSelect }: { b: Bracket; selected: string | null; onSelect: (userId: string | null) => void }) {
  const { user } = useSession();
  if (!b.standings!.length) return null;
  return (
    <section>
      <h2 style={{ font: "700 20px/1.2 var(--font-c)", marginBottom: 12 }}>Classement du tableau</h2>
      <ul className="list">
        {b.standings!.map((s, i) => (
          <li key={s.userId}>
            <button
              type="button"
              className="list-item"
              style={{ width: "100%", border: 0, background: selected === s.userId ? "var(--blue-soft)" : "transparent", textAlign: "left", cursor: "pointer" }}
              onClick={() => onSelect(s.userId === user?.id || selected === s.userId ? null : s.userId)}
              aria-pressed={selected === s.userId}
            >
              <span className="rank-pos" style={{ minWidth: 24 }}>
                {i + 1}
              </span>
              <div className="list-main">
                <div className="list-title">
                  {s.username}
                  {s.userId === user?.id ? " (toi)" : ""}
                </div>
                <div className="list-sub">
                  Mise {coins(s.amount)} · champion : {b.participants[s.picks[b.size - 2]] ?? "?"}
                </div>
              </div>
              <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
                <span className="amount">{s.points} pts</span>
                {b.state === "SETTLED" && <WagerPill status={s.status} payout={s.payout} />}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 8 }}>Touche un joueur pour comparer son tableau aux résultats.</p>
    </section>
  );
}

/** Lock now, fix names or the lock time before it passes, cancel (refunds everyone). */
function Manage({ b }: { b: Bracket }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const refresh = [["bracket", b.id], ["brackets"]];
  const lock = useAction(() => api(`/brackets/${b.id}/lock`, { method: "POST" }), refresh);
  const cancel = useAction(() => api(`/brackets/${b.id}/cancel`, { method: "POST" }), refresh);
  const active = b.state === "OPEN" || b.state === "LOCKED";
  if (!active) return null;
  const error = lock.error || cancel.error;

  return (
    <section className="panel board" aria-label="Gestion du tableau">
      <h2 style={{ font: "700 20px/1.2 var(--font-c)" }}>Gestion du tableau</h2>
      {error && <div className="alert">{error.message}</div>}
      {b.state === "OPEN" && (
        <>
          <button
            className="btn btn-blue btn-block"
            disabled={lock.isPending}
            onClick={() => confirm("Fermer les pronostics maintenant ?") && lock.mutate(undefined, { onSuccess: () => toast("Pronostics fermés") })}
          >
            Fermer les pronostics maintenant
          </button>
          {editing ? <EditForm b={b} onDone={() => setEditing(false)} /> : (
            <button className="btn btn-ghost btn-block" onClick={() => setEditing(true)}>
              Modifier les participants ou l'heure
            </button>
          )}
        </>
      )}
      <div style={{ borderTop: "1px dashed var(--panel-line)", paddingTop: 16, marginTop: 8 }}>
        <button
          className="btn btn-danger btn-block"
          disabled={cancel.isPending}
          onClick={() => {
            if (confirm("Annuler ce tableau ? Toutes les mises seront remboursées.")) cancel.mutate(undefined, { onSuccess: () => toast("Tableau annulé, mises remboursées") });
          }}
        >
          Annuler le tableau
        </button>
      </div>
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function EditForm({ b, onDone }: { b: Bracket; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(b.title);
  const [slots, setSlots] = useState(b.participants);
  const [locksAt, setLocksAt] = useState(toLocalInput(b.locksAt));
  const save = useAction(
    () => api(`/brackets/${b.id}`, { method: "PATCH", body: { title, participants: slots, locksAt: new Date(locksAt).toISOString() } }),
    [["bracket", b.id], ["brackets"]],
  );
  const dark = { background: "var(--panel-2)", borderColor: "var(--panel-line)", color: "var(--panel-text)" };
  return (
    <form
      className="stake"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, {
          onSuccess: () => {
            toast("Tableau modifié");
            onDone();
          },
        });
      }}
    >
      <input className="input" style={dark} required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nom du tableau" />
      <div className="seed-list">
        {Array.from({ length: b.size / 2 }, (_, k) => (
          <fieldset key={k} className="seed-pair dark">
            <legend className="label-c">Match {k + 1}</legend>
            {[2 * k, 2 * k + 1].map((i) => (
              <input
                key={i}
                className="input"
                style={dark}
                maxLength={40}
                value={slots[i]}
                placeholder="Exempt"
                onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Match ${k + 1}, place ${i + 1}`}
              />
            ))}
          </fieldset>
        ))}
      </div>
      <label className="field">
        <span className="label-c">Fin des pronostics</span>
        <input className="input" style={dark} type="datetime-local" required value={locksAt} onChange={(e) => setLocksAt(e.target.value)} />
      </label>
      {b.entryCount > 0 && (
        <small style={{ color: "var(--panel-muted)", fontSize: 12 }}>Des pronostics existent : tu peux renommer, mais pas déplacer les exempts.</small>
      )}
      {save.error && <div className="alert">{save.error.message}</div>}
      <div className="stake-actions">
        <button className="btn btn-gold btn-block" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : "Enregistrer"}
        </button>
        <button type="button" className="link-btn" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}
