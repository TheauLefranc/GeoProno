import type { LeaderRow } from "../lib/api";
import { coins, signed } from "../lib/format";
import { Led } from "./Led";

export function Podium({ rows }: { rows: LeaderRow[] }) {
  const [first, second, third] = rows;
  if (!first) return null;
  const step = (r: LeaderRow | undefined, pos: number) =>
    r ? (
      <div className={`panel podium-step p${pos}`}>
        <Led value={String(pos)} />
        <span className="podium-name">{r.username}</span>
        <span className="podium-profit">{signed(r.profit)}</span>
      </div>
    ) : null;
  // Centre the podium on however many players have a result.
  const layout =
    rows.length >= 3
      ? {}
      : rows.length === 2
        ? { "--cols": "1fr 1.15fr", "--max": "440px" }
        : { "--cols": "1fr", "--max": "220px" };
  return (
    <div className="podium" style={layout as React.CSSProperties}>
      {step(second, 2)}
      {step(first, 1)}
      {step(third, 3)}
    </div>
  );
}

export function RankList({ rows, meId, start = 0 }: { rows: LeaderRow[]; meId?: string; start?: number }) {
  return (
    <ol className="ranks">
      {rows.map((r, i) => (
        <li key={r.userId} className={`rank${r.userId === meId ? " me" : ""}`}>
          <span className="rank-pos">{start + i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div className="rank-name">
              {r.username}
              {r.userId === meId ? " (toi)" : ""}
            </div>
            <div className="rank-sub">
              {r.bets} pari{r.bets > 1 ? "s" : ""} · {r.bets ? Math.round((r.wins / r.bets) * 100) : 0} % gagnés · solde {coins(r.balance)}
            </div>
          </div>
          <span className={`rank-profit ${r.profit > 0 ? "pos" : r.profit < 0 ? "neg" : ""}`}>{signed(r.profit)}</span>
        </li>
      ))}
    </ol>
  );
}
