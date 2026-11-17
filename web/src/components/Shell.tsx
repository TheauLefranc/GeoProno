import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleUserRound, Medal, Ticket, UsersRound, Vote } from "lucide-react";
import { api } from "../lib/api";
import { coins, CURRENCY } from "../lib/format";
import { useSession } from "../lib/session";
import { Led } from "./Led";

export function Shell() {
  const { user } = useSession();
  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: () => api<{ proposedToVote: number; awaiting: number }>("/bets/counts"),
    refetchInterval: 60_000,
  });
  const toVote = counts.data?.proposedToVote ?? 0;

  const tabs = [
    { to: "/", label: "Paris", icon: Ticket, end: true },
    { to: "/votes", label: "Votes", icon: Vote, badge: toVote },
    { to: "/groupes", label: "Groupes", icon: UsersRound },
    { to: "/classement", label: "Classement", icon: Medal },
    { to: "/moi", label: "Moi", icon: CircleUserRound },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-dot" aria-hidden />
          GEOPRONO
        </Link>
        <Link to="/moi" className="balance" aria-label={`Solde : ${coins(user?.balance ?? 0)} ${CURRENCY}`}>
          <span className="balance-label">Solde</span>
          <Led value={coins(user?.balance ?? 0)} />
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon size={22} strokeWidth={2} aria-hidden />
            {label}
            {badge ? (
              <span className="tab-badge" aria-label={`${badge} à voter`}>
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
