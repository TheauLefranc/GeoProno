import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Skeletons } from "./components/States";
import { useSession } from "./lib/session";
import { AuthPage } from "./pages/Auth";
import { FeedPage } from "./pages/Feed";
import { VotesPage } from "./pages/Votes";
import { ProposePage } from "./pages/Propose";
import { BetPage } from "./pages/Bet";
import { GroupsPage } from "./pages/Groups";
import { GroupPage } from "./pages/Group";
import { LeaderboardPage } from "./pages/Leaderboard";
import { MePage } from "./pages/Me";
import { AdminPage } from "./pages/Admin";
import { MatchesPage } from "./pages/Matches";
import { MatchPage } from "./pages/Match";
import { MatchNewPage } from "./pages/MatchNew";

export function App() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="page" style={{ paddingTop: 24 }}>
        <Skeletons />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/connexion" element={<AuthPage mode="login" />} />
        <Route path="/inscription" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<FeedPage />} />
        <Route path="matchs" element={<MatchesPage />} />
        <Route path="matchs/nouveau" element={<MatchNewPage />} />
        <Route path="matchs/:id" element={<MatchPage />} />
        <Route path="votes" element={<VotesPage />} />
        <Route path="proposer" element={<ProposePage />} />
        <Route path="paris/:id" element={<BetPage />} />
        <Route path="groupes" element={<GroupsPage />} />
        <Route path="groupes/:id" element={<GroupPage />} />
        <Route path="classement" element={<LeaderboardPage />} />
        <Route path="moi" element={<MePage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
