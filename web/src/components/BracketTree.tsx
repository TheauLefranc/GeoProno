import { Check, Trophy, X } from "lucide-react";
import { BYE, entrants, isByeMatch, matchesIn, pointsFor, roundCount, roundLabel, roundOffset } from "../lib/bracket";

interface Props {
  size: number;
  participants: string[];
  /** Winner of each match as displayed: the prediction, or the real results. */
  values: (number | null)[];
  scores?: (string | null)[];
  /** A player's prediction, compared against `values` (results view). */
  compare?: (number | null)[];
  /** Tapping an entrant. Only called on matches `clickable` accepts. */
  onPick?: (match: number, slot: number) => void;
  clickable?: (match: number) => boolean;
  selected?: number | null;
  /** Small line under a match, e.g. its bet state ("on" = highlighted). */
  notes?: ({ text: string; on?: boolean } | null)[];
  label: string;
}

/**
 * Classic knockout tree: one column per round, matches vertically centred on
 * the two they come from. Scrolls sideways inside its panel on a phone.
 */
export function BracketTree({ size, participants, values, scores, compare, onPick, clickable, selected, notes, label }: Props) {
  const rounds = Array.from({ length: roundCount(size) }, (_, r) => r);
  const champion = values[size - 2];
  const name = (slot: number | null) => (slot === null ? null : slot === BYE ? "Exempt" : participants[slot]);

  return (
    <div className="bracket" role="group" aria-label={label}>
      {rounds.map((r) => (
        <div key={r} className="bracket-round">
          <div className="bracket-head">
            <span className="label-c">{roundLabel(size, r)}</span>
            <span className="bracket-pts">+{pointsFor(size, roundOffset(size, r))} pt{r > 0 ? "s" : ""}</span>
          </div>
          <div className="bracket-col">
            {Array.from({ length: matchesIn(size, r) }, (_, k) => {
              const i = roundOffset(size, r) + k;
              const pair = entrants(size, participants, values, i);
              const bye = isByeMatch(size, participants, i);
              const canTap = !!onPick && !bye && (clickable?.(i) ?? true);
              const winner = values[i];
              const mine = compare?.[i] ?? null;
              const lostPick = compare && mine !== null && !pair.includes(mine) ? name(mine) : null;
              return (
                <div key={i} className={`bm${bye ? " is-bye" : ""}${selected === i ? " is-selected" : ""}`}>
                  {pair.map((slot, side) => {
                    const real = slot !== null && slot !== BYE;
                    const won = real && winner === slot;
                    const out = real && winner !== null && winner !== slot;
                    const mark = compare && real && mine === slot ? (winner === null ? "wait" : won ? "ok" : "bad") : null;
                    return (
                      <button
                        key={side}
                        type="button"
                        className={`bs${won ? " win" : ""}${out ? " out" : ""}${!real ? " empty" : ""}`}
                        disabled={!canTap || !real}
                        aria-pressed={onPick ? won : undefined}
                        onClick={() => real && onPick?.(i, slot)}
                      >
                        <span className="bs-name">{name(slot) ?? "À déterminer"}</span>
                        {mark === "ok" && <Check size={14} className="bs-ok" aria-label="bon pronostic" />}
                        {mark === "bad" && <X size={14} className="bs-bad" aria-label="raté" />}
                        {mark === "wait" && <span className="bs-wait" aria-label="ton choix" />}
                      </button>
                    );
                  })}
                  {(scores?.[i] || lostPick || notes?.[i]) && (
                    <div className="bm-foot">
                      {scores?.[i] && <span>{scores[i]}</span>}
                      {notes?.[i] && <span className={notes[i]!.on ? "bm-note on" : "bm-note"}>{notes[i]!.text}</span>}
                      {lostPick && (
                        <span className="bs-bad">
                          <X size={11} aria-hidden /> ton choix : {lostPick}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="bracket-round bracket-champ">
        <div className="bracket-head">
          <span className="label-c">Vainqueur</span>
        </div>
        <div className="bracket-col">
          <div className={`champ${champion !== null ? " on" : ""}`}>
            <Trophy size={22} aria-hidden />
            <span>{champion !== null ? name(champion) : "?"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
