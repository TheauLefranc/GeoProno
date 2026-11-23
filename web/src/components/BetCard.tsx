import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Trophy, Users } from "lucide-react";
import { api, type Bet } from "../lib/api";
import { categoryPath, coins, countdown, CURRENCY, odds, oddsInfo, when } from "../lib/format";
import { useAction, useNow, usePublicConfig } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Led } from "./Led";
import { Spinner } from "./States";
import { useToast } from "./Toast";

const seriesColor = (i: number) => `var(--series-${i % 6})`;

/** inMatch: shown on its match page, so no link back to the match and no manual settling (the final score settles it). */
export function BetCard({ bet, linkTitle = true, inMatch = false }: { bet: Bet; linkTitle?: boolean; inMatch?: boolean }) {
  const now = useNow(1000);
  const { user } = useSession();
  const cfg = usePublicConfig();
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("10");
  const toast = useToast();

  const msLeft = new Date(bet.closesAt).getTime() - now;
  const msToOpen = bet.opensAt ? new Date(bet.opensAt).getTime() - now : 0;
  const notYetOpen = bet.status === "OPEN" && msLeft > 0 && msToOpen > 0;
  const open = bet.status === "OPEN" && msLeft > 0 && !notYetOpen;
  const awaiting = bet.status === "OPEN" && msLeft <= 0;
  const settled = bet.status === "SETTLED";
  const cancelled = bet.status === "CANCELLED";
  const option = bet.options.find((o) => o.id === selected);

  const wager = useAction(
    (v: { optionId: string; amount: number }) =>
      api<{ balance: number }>(`/bets/${bet.id}/wagers`, { body: v }),
    [["bet", bet.id]],
  );

  const stake = Number(amount) || 0;
  const balance = user?.balance ?? 0;
  // Recomputed on every keystroke / slider move. Pool bets include the new stake
  // itself in the pot, which is exactly how the payout will be computed if nothing else moves.
  const potential = option
    ? bet.oddsEnabled
      ? Math.floor((stake * (option.odds ?? 100)) / 100)
      : Math.floor((stake * (bet.pool + stake)) / Math.max(1, option.total + stake))
    : 0;
  const profit = potential - stake;
  const multiplier = stake > 0 ? potential / stake : 0;
  const maxStake = Math.max(0, Math.min(balance, cfg.data?.maxStake ?? balance));

  const submit = () => {
    if (!option) return;
    wager.mutate(
      { optionId: option.id, amount: stake },
      {
        onSuccess: () => {
          setSelected(null);
          toast(
            <>
              Mise placée sur {option.label} · solde <Led value={coins(balance - stake)} />
            </>,
          );
        },
      },
    );
  };

  const many = bet.options.length > 2;
  const myTotal = bet.myWagers.reduce((s, w) => s + w.amount, 0);
  const myWin = bet.myWagers.reduce((s, w) => s + (w.payout ?? 0), 0);
  const winner = bet.options.find((o) => o.id === bet.winningOptionId);

  return (
    <article className="panel board" aria-label={bet.title}>
      <div className="board-strip">
        <span className="label-c">
          {bet.bracketMatch && bet.description ? bet.description : categoryPath(bet.category)}
          {bet.group ? ` · ${bet.group.name}` : ""}
        </span>
        <div className={`clock${open && msLeft < 3600_000 ? " soon" : ""}`}>
          {notYetOpen && (
            <>
              <span className="label-c">Paris dans</span>
              <Led value={countdown(msToOpen)} />
            </>
          )}
          {open && (
            <>
              <span className="label-c">Ferme dans</span>
              <Led value={countdown(msLeft)} />
            </>
          )}
          {awaiting && <span className="stamp muted">Mises fermées</span>}
          {settled && <span className="stamp gold">Réglé</span>}
          {cancelled && <span className="stamp red">Annulé</span>}
          {bet.status === "REJECTED" && <span className="stamp red">Refusé</span>}
          {bet.status === "PROPOSED" && <span className="stamp blue">En vote</span>}
        </div>
      </div>
      {linkTitle ? (
        <Link to={`/paris/${bet.id}`} className="board-title">
          {bet.title}
        </Link>
      ) : (
        <h1 className="board-title">{bet.title}</h1>
      )}

      <div className={`sides${many ? " many" : ""}`} role="group" aria-label="Choisis ton camp">
        {bet.options.map((o, i) => {
          const isWin = settled && o.id === bet.winningOptionId;
          const isLost = settled && o.id !== bet.winningOptionId;
          const info = oddsInfo(o.odds);
          return (
            <button
              key={o.id}
              type="button"
              className={`side${isWin ? " won" : ""}${isLost ? " lost" : ""}`}
              style={{ ["--c" as string]: seriesColor(i), ["--p" as string]: info?.p ?? 0 }}
              aria-pressed={selected === o.id}
              disabled={!open}
              onClick={() => setSelected(selected === o.id ? null : o.id)}
            >
              <span className={`side-name${cancelled ? " struck" : ""}`}>{o.label}</span>
              <Led
                value={odds(o.odds)}
                className={info ? `odds odds-${info.tier}` : "odds muted"}
                label={info ? `cote ${odds(o.odds)}, ${info.pct} % de chances, ${info.tierLabel}` : "pas encore de cote"}
              />
              <span className="side-sub">
                {isWin ? (
                  <span className="tag gold">
                    <Trophy size={12} aria-hidden /> Gagnant
                  </span>
                ) : (
                  <>
                    {info && <strong className={`chance chance-${info.tier}`}>{info.pct} %</strong>}
                    {info ? " · " : ""}
                    {coins(o.total)} misés
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {open && !option && <p className="tap-hint">Touche une équipe pour parier</p>}

      {bet.pool > 0 && (
        <>
          <div className="split" aria-hidden>
            {bet.options.map((o, i) => (
              <i key={o.id} style={{ flexGrow: o.total, ["--c" as string]: seriesColor(i) }} />
            ))}
          </div>
          <div className="pool-row">
            <span>
              Cagnotte <strong>{coins(bet.pool)}</strong>
            </span>
            <span>{bet.options.map((o) => `${Math.round((o.total / bet.pool) * 100)} %`).join(" · ")}</span>
          </div>
        </>
      )}

      {option && open && (
        <form
          className="stake"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="stake-input">
            <span className="label-c">Mise</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
              aria-label={`Mise sur ${option.label}`}
              autoFocus
            />
          </label>
          {maxStake > 0 && (
            <input
              type="range"
              className="stake-range"
              min={0}
              max={maxStake}
              step={1}
              value={Math.min(stake, maxStake)}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Ajuster la mise"
              style={{ ["--fill" as string]: `${(Math.min(stake, maxStake) / maxStake) * 100}%` }}
            />
          )}
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

          <div className="gain-panel" aria-live="polite">
            <div className="gain-main">
              <span className="label-c">Si {option.label} gagne, tu récupères</span>
              <Led value={stake > 0 ? coins(potential) : "0"} label={`${coins(potential)} ${CURRENCY}`} />
            </div>
            <div className="gain-facts">
              <span>
                Bénéfice{" "}
                <strong className={profit > 0 ? "gain-up" : ""}>{stake > 0 ? `+${coins(Math.max(0, profit))}` : "—"}</strong>
              </span>
              <span>
                Multiplicateur <strong>{stake > 0 ? `×${multiplier.toFixed(2)}` : "—"}</strong>
              </span>
            </div>
            {!bet.oddsEnabled &&
              (bet.pool - option.total === 0 ? (
                <small>
                  Personne n'a encore misé sur les autres issues : pour l'instant tu ne récupérerais que ta mise. Ton gain grimpe dès que
                  d'autres parient contre toi.
                </small>
              ) : (
                <small>Estimation : en cagnotte, le gain final dépend aussi des mises placées après la tienne.</small>
              ))}
          </div>

          {wager.error && <div className="alert">{wager.error.message}</div>}
          {stake > balance && <div className="alert">Solde insuffisant : tu as {coins(balance)} {CURRENCY}.</div>}
          <div className="stake-actions">
            <button className="btn btn-gold btn-block" disabled={wager.isPending || stake <= 0 || stake > balance}>
              {wager.isPending ? <Spinner /> : stake > 0 ? `Miser ${coins(stake)} pour gagner ${coins(potential)}` : "Choisis ta mise"}
            </button>
            <button type="button" className="link-btn" onClick={() => setSelected(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="board-foot">
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {bet.group && (
            <span className="tag blue">
              <Users size={12} aria-hidden /> Défi de groupe
            </span>
          )}
          <span className="tag">{bet.oddsEnabled ? "Cote fixe" : "Cagnotte"}</span>
        </div>
        {bet.matchId && !inMatch && (
          <Link to={`/matchs/${bet.matchId}`} className="label-c" style={{ color: "var(--blue-hi)" }}>
            Voir le match
          </Link>
        )}
        {bet.bracketMatch && !inMatch && (
          <Link to={`/tableaux/${bet.bracketMatch.bracketId}`} className="label-c" style={{ color: "var(--blue-hi)" }}>
            Voir le tableau
          </Link>
        )}
        {!open && !notYetOpen && !settled && !cancelled && (
          <span className="label-c">
            <Lock size={11} aria-hidden /> {when(bet.closesAt)}
          </span>
        )}
      </div>

      {myTotal > 0 && (
        <div className="pool-row">
          <span>
            Ta mise <strong>{coins(myTotal)}</strong>
          </span>
          {settled && (
            <span>
              {myWin > 0 ? (
                <>
                  Gagné <strong style={{ color: "var(--gold)" }}>{coins(myWin)}</strong>
                </>
              ) : (
                "Perdu"
              )}
            </span>
          )}
          {cancelled && <span>Remboursée</span>}
        </div>
      )}
      {awaiting && bet.canModerate && !bet.matchId && !bet.bracketMatch && (
        <Link to={`/paris/${bet.id}`} className="btn btn-ghost btn-sm">
          Saisir le résultat
        </Link>
      )}
      {settled && winner && !myTotal && <span className="sr-only">Résultat : {winner.label}</span>}
    </article>
  );
}
