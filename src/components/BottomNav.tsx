import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();

  const isHome = path === '/' || path === '/dashboard' || path === '/dashboard-home' || path === '/dashboard-home.html';
  const isHub = path.startsWith('/content-hub') || path.startsWith('/notes-hub') || path.startsWith('/college-hub');
  const isLeaderboard = path.startsWith('/mainleaderboard') || path.startsWith('/leaderboard');
  const isProfile = path.startsWith('/profile');

  // Hide bottom nav during full-screen mock test or focus timer sessions
  if (path.startsWith('/run-test') || path === '/focus' || path === '/focus.html') {
    return null;
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '64px',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 10002,
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.04)'
      }}
    >
      <button
        onClick={() => navigate('/dashboard-home')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '6px 10px',
          borderRadius: '14px',
          minWidth: '56px',
          flex: 1,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: isHome ? 'var(--accent)' : 'var(--text3)',
          transition: 'all 0.18s ease',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <i
          className="fa-solid fa-house"
          style={{
            fontSize: '19px',
            transform: isHome ? 'scale(1.18)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            color: isHome ? 'var(--accent)' : 'inherit'
          }}
        />
        <span style={{ fontSize: '10.5px', fontWeight: isHome ? 700 : 500 }}>Home</span>
      </button>

      <button
        onClick={() => navigate('/content-hub')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '6px 10px',
          borderRadius: '14px',
          minWidth: '56px',
          flex: 1,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: isHub ? 'var(--accent)' : 'var(--text3)',
          transition: 'all 0.18s ease',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <i
          className="fa-solid fa-layer-group"
          style={{
            fontSize: '19px',
            transform: isHub ? 'scale(1.18)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            color: isHub ? 'var(--accent)' : 'inherit'
          }}
        />
        <span style={{ fontSize: '10.5px', fontWeight: isHub ? 700 : 500 }}>Hub</span>
      </button>

      <button
        onClick={() => navigate('/mainleaderboard')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '6px 10px',
          borderRadius: '14px',
          minWidth: '56px',
          flex: 1,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: isLeaderboard ? 'var(--accent)' : 'var(--text3)',
          transition: 'all 0.18s ease',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <i
          className="fa-solid fa-trophy"
          style={{
            fontSize: '19px',
            transform: isLeaderboard ? 'scale(1.18)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            color: isLeaderboard ? 'var(--accent)' : 'inherit'
          }}
        />
        <span style={{ fontSize: '10.5px', fontWeight: isLeaderboard ? 700 : 500 }}>Leaderboard</span>
      </button>

      <button
        onClick={() => navigate('/profile')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '6px 10px',
          borderRadius: '14px',
          minWidth: '56px',
          flex: 1,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: isProfile ? 'var(--accent)' : 'var(--text3)',
          transition: 'all 0.18s ease',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <i
          className="fa-regular fa-circle-user"
          style={{
            fontSize: '19px',
            transform: isProfile ? 'scale(1.18)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            color: isProfile ? 'var(--accent)' : 'inherit'
          }}
        />
        <span style={{ fontSize: '10.5px', fontWeight: isProfile ? 700 : 500 }}>Profile</span>
      </button>
    </nav>
  );
};
