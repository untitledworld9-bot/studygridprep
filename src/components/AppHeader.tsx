import React from 'react';
import { useAuth } from '../context/AuthContext';

interface AppHeaderProps {
  onOpenSidebar: () => void;
  onOpenNotifications: () => void;
  onOpenStreakMilestone?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenSidebar,
  onOpenNotifications,
  onOpenStreakMilestone
}) => {
  const { profile } = useAuth();
  const firstName = profile.name ? profile.name.split(' ')[0] : 'Student';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Hamburger menu button */}
      <button
        onClick={onOpenSidebar}
        aria-label="Open menu"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          cursor: 'pointer',
          padding: '9px 10px',
          borderRadius: '12px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <span style={{ width: '20px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
        <span style={{ width: '14px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
        <span style={{ width: '20px', height: '2px', background: 'var(--text)', borderRadius: '2px' }} />
      </button>

      {/* Greeting Title */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-hand" style={{ fontSize: '14px', color: '#F59E0B' }} />
          <span
            style={{
              fontSize: '15.5px',
              fontWeight: 700,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            Hey, {firstName}
          </span>
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '1px'
          }}
        >
          {profile.goal ? `Target: ${profile.goal}` : "Let's achieve your goals today!"}
        </div>
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Streak Badge */}
        <button
          onClick={onOpenStreakMilestone}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(249,115,22,0.12)',
            border: '1.5px solid rgba(249,115,22,0.3)',
            borderRadius: '50px',
            padding: '5px 11px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: 'var(--orange)',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-fire" style={{ color: 'var(--orange)', fontSize: '13px' }} />
          <span>{profile.streak || 0}</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text2)'
          }}
        >
          <i className="fa-solid fa-bell" style={{ fontSize: '14px' }} />
          <span
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '7px',
              height: '7px',
              background: 'var(--red)',
              borderRadius: '50%',
              border: '1.5px solid var(--bg)'
            }}
          />
        </button>
      </div>
    </header>
  );
};
