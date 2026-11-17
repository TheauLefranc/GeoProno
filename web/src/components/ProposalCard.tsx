import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api, type Bet } from "../lib/api";
import { categoryLabel, odds, when } from "../lib/format";
import { useAction } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Spinner } from "./States";

export function VoteCells({ count, required }: { count: number; required: number }) {
  const n = Math.min(required, 20);
  const filled = Math.round((Math.min(count, required) / required) * n);
  return (
    <div className="cells" style={{ ["--n" as string]: n }} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`${i < filled ? "on" : ""}${i === filled - 1 ? " last" : ""}`} />
      ))}
    </div>
  );
}

export function ProposalCard({ bet }: { bet: Bet }) {
  const toggle = useAction(() => api(`/bets/${bet.id}/vote`, { method: bet.myVote ? "DELETE" : "POST" }), [["bet", bet.id]]);
  const { user } = useSession();
  const isMine = bet.creator.id === user?.id;
  const missing = Math.max(0, bet.votesRequired - bet.voteCount);

  return (
    <article className="proposal" aria-label={bet.title}>
      <Link to={`/paris/${bet.id}`} className="proposal-title">
        {bet.title}
      </Link>
      <div className="meta">
        <span>{categoryLabel(bet.category)}</span>
        {bet.group && <span>Groupe {bet.group.name}</span>}
        <span>Proposé par {bet.creator.username}</span>
        <span>Clôture {when(bet.closesAt)}</span>
      </div>
      <div className="options-inline">
        {bet.options.map((o) => (
          <span key={o.id}>
            {o.label}
            {bet.oddsEnabled && o.odds ? ` · ${odds(o.odds)}` : ""}
          </span>
        ))}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <VoteCells count={bet.voteCount} required={bet.votesRequired} />
        <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
          <strong>
            {bet.voteCount}/{bet.votesRequired} votes
          </strong>
          <span style={{ color: "var(--ink-2)" }}>
            {missing === 0 ? "Validé" : missing === 1 ? "Plus qu'un vote" : `Encore ${missing} votes`}
          </span>
        </div>
      </div>
      {toggle.error && <div className="alert">{toggle.error.message}</div>}
      {isMine ? (
        <p className="alert info">Ta proposition compte déjà ton vote. Partage-la pour récolter les autres.</p>
      ) : (
      <button
        className={`btn btn-block ${bet.myVote ? "btn-ghost" : "btn-dark"}`}
        onClick={() => toggle.mutate(undefined)}
        disabled={toggle.isPending}
        aria-pressed={bet.myVote}
      >
        {toggle.isPending ? (
          <Spinner />
        ) : bet.myVote ? (
          <>
            <Check size={18} aria-hidden /> Tu as voté · retirer
          </>
        ) : (
          "Je veux parier là-dessus"
        )}
      </button>
      )}
    </article>
  );
}
