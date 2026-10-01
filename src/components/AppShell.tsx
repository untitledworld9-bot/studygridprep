import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { BottomNav } from './BottomNav';
import { SetGoalModal } from './SetGoalModal';
import { StreakMilestoneModal } from './StreakMilestoneModal';
import { NotificationsDrawer } from './NotificationsDrawer';
import { RatingModal } from './RatingModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);

  const location = useLocation();
  const path = location.pathname.toLowerCase();

  // Pages that don't need the default header
  const isCbtRun = path.startsWith('/run-test');
  const isFocusFullScreen = path === '/focus' || path === '/focus.html';
  const isAuthPage = path === '/login' || path === '/login.html';
  const isWelcomePage = path === '/mainwelcome' || path === '/mainwelcome.html';
  const isStandaloneLanding = path === '/landing' || path === '/landing.html';

  const showShellChrome = !isCbtRun && !isFocusFullScreen && !isAuthPage && !isWelcomePage && !isStandaloneLanding;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {showShellChrome && (
        <AppHeader
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenNotifications={() => setNotifsOpen(true)}
          onOpenStreakMilestone={() => setStreakModalOpen(true)}
        />
      )}

      {showShellChrome && (
        <AppSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenRating={() => setRatingModalOpen(true)}
        />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {children}
      </main>

      {showShellChrome && <BottomNav />}

      <SetGoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
      />

      <StreakMilestoneModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
      />

      <NotificationsDrawer
        isOpen={notifsOpen}
        onClose={() => setNotifsOpen(false)}
      />

      <RatingModal
        isOpen={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
      />
    </div>
  );
};
