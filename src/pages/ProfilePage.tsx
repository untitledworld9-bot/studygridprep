import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { computeLevel } from '../services/uwCore';

export const ProfilePage: React.FC = () => {
  const { profile, logout, setGoal } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const navigate = useNavigate();

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState(profile.goal || 'JEE Main 2027');

  const level = computeLevel(profile.xp || 0);
  const initial = (profile.name || 'S').charAt(0).toUpperCase();

  const handleSaveGoal = async () => {
    await setGoal(goalText);
    setIsEditingGoal(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/dashboard-home')}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text)'
          }}
        >
          <i className="fa-solid fa-arrow-left" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>My Profile</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Manage your study settings</div>
        </div>

        <button
          onClick={() => navigate('/subscription')}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#F59E0B'
          }}
        >
          <i className="fa-solid fa-crown" />
        </button>
      </div>

      {/* Avatar & User Info Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '28px',
            fontWeight: 800,
            boxShadow: '0 6px 20px rgba(91,91,246,0.35)'
          }}
        >
          {initial}
        </div>

        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '3px' }}>
          {profile.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px' }}>
          {profile.email || 'Free Student Member'}
        </div>

        <div style={{ display: 'inline-flex', gap: '8px', padding: '4px 14px', borderRadius: '50px', background: 'rgba(91,91,246,0.1)', color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>
          <span>Level {level}</span>
          <span>•</span>
          <span>{profile.xp || 0} Total XP</span>
        </div>
      </div>

      {/* Target Goal Setting */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '16px 18px',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            <i className="fa-solid fa-bullseye" style={{ color: 'var(--accent)' }} />
            <span>Target Exam</span>
          </div>
          <button
            onClick={() => setIsEditingGoal(!isEditingGoal)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {isEditingGoal ? 'Cancel' : 'Change'}
          </button>
        </div>

        {isEditingGoal ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input
              type="text"
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSaveGoal}
              style={{
                padding: '9px 16px',
                borderRadius: '12px',
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--accent)' }}>
            {profile.goal || 'JEE Main 2027'}
          </div>
        )}
      </div>

      {/* Theme Setting */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '16px 18px',
          marginBottom: '14px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>
          Appearance Mode
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          {(['light', 'dark', 'system'] as const).map(t => (
            <button
              key={t}
              onClick={() => setThemeMode(t)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '10px',
                border: 'none',
                background: mode === t ? 'var(--surface)' : 'transparent',
                color: mode === t ? 'var(--accent)' : 'var(--text2)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.18s ease'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1.5px solid rgba(239,68,68,0.22)',
          color: '#EF4444',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <i className="fa-solid fa-arrow-right-from-bracket" />
        <span>Log Out Account</span>
      </button>
    </div>
  );
};
