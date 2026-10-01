import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';

// Page components
import { DashboardPage } from './pages/DashboardPage';
import { ContentHubPage } from './pages/ContentHubPage';
import { ContentViewPage } from './pages/ContentViewPage';
import { NotesHubPage } from './pages/NotesHubPage';
import { NotesViewPage } from './pages/NotesViewPage';
import { CollegeHubPage } from './pages/CollegeHubPage';
import { CollegeViewPage } from './pages/CollegeViewPage';
import { MainLeaderboardPage } from './pages/MainLeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { TimerPage } from './pages/TimerPage';
import { FocusPage } from './pages/FocusPage';
import { TodoPage } from './pages/TodoPage';
import { ProgressPage } from './pages/ProgressPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { MockHomePage } from './pages/MockHomePage';
import { JeeMockSelectPage } from './pages/JeeMockSelectPage';
import { CuetMockSelectPage } from './pages/CuetMockSelectPage';
import { JeeInstructionsPage } from './pages/JeeInstructionsPage';
import { CuetInstructionsPage } from './pages/CuetInstructionsPage';
import { RunTestPage } from './pages/RunTestPage';
import { ResultSummaryPage } from './pages/ResultSummaryPage';
import { ResultAnalysisPage } from './pages/ResultAnalysisPage';
import { AiAnalysisPage } from './pages/AiAnalysisPage';
import { SolutionsPage } from './pages/SolutionsPage';
import { TestHistoryPage } from './pages/TestHistoryPage';
import { LoginPage } from './pages/LoginPage';
import { WelcomePage } from './pages/WelcomePage';
import { SplashScreen } from './components/SplashScreen';

// Root Route Gate: checks if user is logged in
const RootGate: React.FC = () => {
  const { user, loading } = useAuth();
  const hasLocalUser = Boolean(localStorage.getItem('userName'));

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '12px' }}>
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '36px', color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Loading Study Grid Prep…</div>
        </div>
      </div>
    );
  }

  if (user || hasLocalUser) {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const seenWelcome = localStorage.getItem('seenWelcome') === 'yes';
    if (isPWA && !seenWelcome) {
      return <WelcomePage />;
    }
    return <DashboardPage />;
  }

  return <LoginPage />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SplashScreen />
        <BrowserRouter>
          <AppShell>
            <Routes>
              {/* Root */}
              <Route path="/" element={<RootGate />} />

              {/* Main Dashboard */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard-home" element={<DashboardPage />} />
              <Route path="/dashboard-home.html" element={<DashboardPage />} />

              {/* Content Hub & Articles */}
              <Route path="/content-hub" element={<ContentHubPage />} />
              <Route path="/content-hub.html" element={<ContentHubPage />} />
              <Route path="/content/:id" element={<ContentViewPage />} />
              <Route path="/content" element={<ContentViewPage />} />
              <Route path="/content.html" element={<ContentViewPage />} />
              <Route path="/content-render.html" element={<ContentViewPage />} />

              {/* Notes Hub */}
              <Route path="/notes-hub" element={<NotesHubPage />} />
              <Route path="/notes-hub.html" element={<NotesHubPage />} />
              <Route path="/notes-view" element={<NotesViewPage />} />
              <Route path="/notes-hub-view.html" element={<NotesViewPage />} />

              {/* College Hub */}
              <Route path="/college-hub" element={<CollegeHubPage />} />
              <Route path="/college-hub.html" element={<CollegeHubPage />} />
              <Route path="/college-view" element={<CollegeViewPage />} />
              <Route path="/college-view.html" element={<CollegeViewPage />} />

              {/* Leaderboards */}
              <Route path="/mainleaderboard" element={<MainLeaderboardPage />} />
              <Route path="/mainleaderboard.html" element={<MainLeaderboardPage />} />
              <Route path="/leaderboard" element={<MainLeaderboardPage />} />
              <Route path="/leaderboard.html" element={<MainLeaderboardPage />} />

              {/* User Profile & Subscription */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile.html" element={<ProfilePage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/subscription.html" element={<SubscriptionPage />} />

              {/* Productivity Tools */}
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/timer.html" element={<TimerPage />} />
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/focus.html" element={<FocusPage />} />
              <Route path="/todo" element={<TodoPage />} />
              <Route path="/todo.html" element={<TodoPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/progress.html" element={<ProgressPage />} />
              <Route path="/playlist" element={<PlaylistPage />} />
              <Route path="/playlist.html" element={<PlaylistPage />} />

              {/* Mock Test System */}
              <Route path="/mock-home" element={<MockHomePage />} />
              <Route path="/mock-home.html" element={<MockHomePage />} />
              <Route path="/jeemockselect" element={<JeeMockSelectPage />} />
              <Route path="/jeemockselect.html" element={<JeeMockSelectPage />} />
              <Route path="/cuetmockselect" element={<CuetMockSelectPage />} />
              <Route path="/cuetmockselect.html" element={<CuetMockSelectPage />} />
              <Route path="/jeeinstructions" element={<JeeInstructionsPage />} />
              <Route path="/jeeinstructions.html" element={<JeeInstructionsPage />} />
              <Route path="/cuetinstructions" element={<CuetInstructionsPage />} />
              <Route path="/cuetinstructions.html" element={<CuetInstructionsPage />} />
              <Route path="/run-test" element={<RunTestPage />} />
              <Route path="/run-test.html" element={<RunTestPage />} />
              <Route path="/result-summary" element={<ResultSummaryPage />} />
              <Route path="/result-summary.html" element={<ResultSummaryPage />} />
              <Route path="/result-analysis" element={<ResultAnalysisPage />} />
              <Route path="/result-analysis.html" element={<ResultAnalysisPage />} />
              <Route path="/ai-analysis" element={<AiAnalysisPage />} />
              <Route path="/ai-analysis.html" element={<AiAnalysisPage />} />
              <Route path="/solutions" element={<SolutionsPage />} />
              <Route path="/solutions.html" element={<SolutionsPage />} />
              <Route path="/testhistory" element={<TestHistoryPage />} />
              <Route path="/testhistory.html" element={<TestHistoryPage />} />

              {/* Auth & Onboarding */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login.html" element={<LoginPage />} />
              <Route path="/mainwelcome" element={<WelcomePage />} />
              <Route path="/mainwelcome.html" element={<WelcomePage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};
