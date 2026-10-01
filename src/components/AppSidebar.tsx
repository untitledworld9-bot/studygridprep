import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { computeLevel } from '../services/uwCore';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRating: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen, onClose, onOpenRating }) => {
  const { profile, logout } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const navigate = useNavigate();

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const level = computeLevel(profile.xp || 0);
  const initial = (profile.name || 'S').charAt(0).toUpperCase();

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 99990,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '290px',
          height: '100%',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          paddingBottom: '90px',
          overflowY: 'auto',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          zIndex: 99999,
          boxShadow: isOpen ? '8px 0 36px rgba(0,0,0,0.2)' : 'none'
        }}
      >
        {/* Header Profile Box */}
        <div
          onClick={() => handleNav('/profile')}
          style={{
            padding: '24px 18px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(91,91,246,0.08), rgba(124,58,237,0.04))',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#fff',
                fontSize: '20px',
                boxShadow: '0 4px 14px rgba(91,91,246,0.3)',
                flexShrink: 0
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {profile.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text2)',
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {profile.email || 'Free Student Plan'}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  marginTop: '4px'
                }}
              >
                <span>
                  <i className="fa-solid fa-bolt" style={{ color: '#F59E0B', marginRight: '4px' }} />
                  {profile.xp || 0} XP
                </span>
                <span>•</span>
                <span>Lvl {level}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Theme mode selector */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--text3)',
              marginBottom: '8px'
            }}
          >
            Appearance
          </div>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => setThemeMode(t)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '7px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  background: mode === t ? 'var(--surface)' : 'transparent',
                  color: mode === t ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  boxShadow: mode === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <i
                  className={
                    t === 'light'
                      ? 'fa-solid fa-sun'
                      : t === 'dark'
                      ? 'fa-solid fa-moon'
                      : 'fa-solid fa-circle-half-stroke'
                  }
                  style={{ fontSize: '10px' }}
                />
                <span style={{ textTransform: 'capitalize' }}>{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Links Navigation */}
        <div style={{ padding: '0 12px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--text3)',
              padding: '10px 6px 4px'
            }}
          >
            Study Tools
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <button
              onClick={() => handleNav('/mock-home')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-file-pen" style={{ color: '#7C3AED', width: '20px' }} />
              <span>Mock Tests (JEE / CUET)</span>
              <span style={badgeStyle}>Active</span>
            </button>

            <button
              onClick={() => handleNav('/timer')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-stopwatch" style={{ color: '#10B981', width: '20px' }} />
              <span>Smart Focus Room</span>
            </button>

            <button
              onClick={() => handleNav('/playlist')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-play" style={{ color: '#EF4444', width: '20px' }} />
              <span>Study Playlist</span>
            </button>

            <button
              onClick={() => handleNav('/todo')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-list-check" style={{ color: '#0EA5E9', width: '20px' }} />
              <span>Daily Todo Planner</span>
            </button>

            <button
              onClick={() => handleNav('/progress')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-chart-simple" style={{ color: '#F97316', width: '20px' }} />
              <span>Progress & Analytics</span>
            </button>

            <button
              onClick={() => handleNav('/mainleaderboard')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-trophy" style={{ color: '#F59E0B', width: '20px' }} />
              <span>Main Leaderboard</span>
            </button>

            <button
              onClick={() => handleNav('/subscription')}
              style={sidebarBtnStyle}
            >
              <i className="fa-solid fa-crown" style={{ color: '#F59E0B', width: '20px' }} />
              <span>Pro Subscription</span>
              <span style={{ ...badgeStyle, color: '#F59E0B', background: 'rgba(245,158,11,0.12)' }}>
                Upgrade
              </span>
            </button>
          </div>

          {/* Social and Feedback */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--text3)',
              padding: '16px 6px 4px'
            }}
          >
            Community & Support
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <a
              href="https://youtube.com/@studygridprep"
              target="_blank"
              rel="noreferrer"
              style={{
                ...sidebarBtnStyle,
                textDecoration: 'none',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: '#EF4444'
              }}
            >
              <i className="fa-brands fa-youtube" style={{ fontSize: '15px', width: '20px' }} />
              <span>YouTube Community</span>
            </a>

            <button
              onClick={() => {
                onClose();
                onOpenRating();
              }}
              style={{
                ...sidebarBtnStyle,
                border: '1px solid var(--border)'
              }}
            >
              <i className="fa-solid fa-star" style={{ color: '#F97316', width: '20px' }} />
              <span>Rate Study Grid Prep</span>
            </button>
          </div>

          {/* Logout */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.22)',
                color: '#EF4444',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const sidebarBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '11px 13px',
  borderRadius: '12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'background 0.15s ease'
};

const badgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '9.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  padding: '2px 7px',
  borderRadius: '50px',
  background: 'rgba(91,91,246,0.12)',
  color: 'var(--accent)'
};
