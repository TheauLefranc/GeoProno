import { Link } from "react-router-dom";
import { ChevronRight, MapPin } from "lucide-react";
import type { Match } from "../lib/api";
import { categoryPath, countdown } from "../lib/format";
import { useNow } from "../lib/hooks";
import { Led } from "./Led";

const hhmm = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** One fixture as a compact scoreboard: time or live state, both teams and their scores, bet status. */
export function MatchRow({ match: m }: { match: Match }) {
  const now = useNow(30_000);
  const live = m.status === "LIVE";
  const finished = m.status === "FINISHED";
  const cancelled = m.status === "CANCELLED";
  const showScore = live || finished;
  const homeLead = m.homeScore > m.awayScore;
  const awayLead = m.awayScore > m.homeScore;

  return (
    <Link to={`/matchs/${m.id}`} className={`panel match${live ? " is-live" : ""}`} aria-label={`${m.homeName} contre ${m.awayName}`}>
      <div className="match-time">
        {live ? (
          <>
            <span className="live-dot">Direct</span>
            {m.liveNote && <span className="label-c">{m.liveNote}</span>}
          </>
        ) : finished ? (
          <span className="label-c">Terminé</span>
        ) : cancelled ? (
          <span className="stamp red">Annulé</span>
        ) : (
          <Led value={hhmm.format(new Date(m.startsAt))} />
        )}
      </div>

      <div className="match-teams">
        <div className={`match-team${finished && !homeLead ? " dim" : ""}`}>
          <span className={`match-name${cancelled ? " struck" : ""}`}>{m.homeName}</span>
          {showScore && <Led value={String(m.homeScore)} className={finished && homeLead ? "" : "score-dim"} />}
        </div>
        <div className={`match-team${finished && !awayLead ? " dim" : ""}`}>
          <span className={`match-name${cancelled ? " struck" : ""}`}>{m.awayName}</span>
          {showScore && <Led value={String(m.awayScore)} className={finished && awayLead ? "" : "score-dim"} />}
        </div>
        <div className="match-meta">
          <span>{categoryPath(m.category)}</span>
          {m.location && (
            <span>
              <MapPin size={11} aria-hidden /> {m.location}
            </span>
          )}
          <BetStatus match={m} now={now} />
        </div>
      </div>
      <ChevronRight size={18} aria-hidden className="match-chev" />
    </Link>
  );
}

function BetStatus({ match: m, now }: { match: Match; now: number }) {
  const b = m.bet;
  if (!b) return null;
  if (b.status === "SETTLED") return <span className="bet-state">Pari réglé</span>;
  if (b.status === "CANCELLED") return <span className="bet-state">Pari remboursé</span>;
  if (b.acceptingWagers) return <span className="bet-state on">Paris ouverts</span>;
  if (b.opensAt && new Date(b.opensAt).getTime() > now)
    return <span className="bet-state">Paris dans {countdown(new Date(b.opensAt).getTime() - now).toLowerCase()}</span>;
  return <span className="bet-state">Paris fermés</span>;
}
