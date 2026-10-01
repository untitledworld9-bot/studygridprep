import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import confetti from 'canvas-confetti';

export const WelcomePage: React.FC = () => {
  const { user } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const navigate = useNavigate();

  const [isReturning, setIsReturning] = useState(false);
  const [userName, setUserName] = useState('Learner');
  const [agreed, setAgreed] = useState(true);
  const [showAgreeModal, setShowAgreeModal] = useState(false);

  useEffect(() => {
    const returning = localStorage.getItem('returningUser') === 'yes';
    setIsReturning(returning);

    const storedName = localStorage.getItem('userName') || user?.displayName || 'Learner';
    setUserName(storedName);

    // Fire confetti on first visit
    if (!returning) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }, [user]);

  const handleContinue = () => {
    if (!agreed) {
      setShowAgreeModal(true);
      return;
    }
    localStorage.setItem('returningUser', 'yes');
    localStorage.setItem('seenWelcome', 'yes');
    navigate('/dashboard-home');
  };

  const avatarInitial = userName ? userName.charAt(0).toUpperCase() : 'U';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* ─── HEADER BAR ─── */}
      <header
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(91,91,246,0.25)'
            }}
          >
            <img
              src="/icon-192.png"
              alt="Study Grid Prep"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              Study Grid Prep
            </span>
            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text3)', marginTop: '2px' }}>
              Your exam partner
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Theme Toggle */}
          <button
            onClick={() => setThemeMode(mode === 'dark' ? 'light' : 'dark')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '13px'
            }}
            title="Toggle theme"
          >
            <i className={mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
          </button>

          {/* Member Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '50px',
              fontSize: '11.5px',
              fontWeight: 700,
              background: isReturning ? 'rgba(91,91,246,0.10)' : 'rgba(16,185,129,0.10)',
              border: `1.5px solid ${isReturning ? 'rgba(91,91,246,0.28)' : 'rgba(16,185,129,0.28)'}`,
              color: isReturning ? 'var(--accent)' : 'var(--green)'
            }}
          >
            <i className={isReturning ? 'fa-solid fa-hand-wave' : 'fa-solid fa-sparkles'} style={{ fontSize: '10px' }} />
            <span>{isReturning ? 'Welcome Back' : 'New Member'}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTAINER ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '20px 16px 40px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Avatar + Welcome Block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 16px', textAlign: 'center' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #5B5BF6, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '34px',
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 8px 28px rgba(91,91,246,0.35)',
              marginBottom: '16px',
              letterSpacing: '-1px'
            }}
          >
            {avatarInitial}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            {isReturning ? `Welcome back, ${userName}!` : `Welcome, ${userName}!`}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 400, lineHeight: 1.55, maxWidth: '300px' }}>
            {isReturning
              ? 'Ready to continue your streak and mock prep today?'
              : 'Your complete study engine for JEE, NEET, CUET & Boards.'}
          </p>
        </div>

        {/* Feature Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Card 1: Mock Tests */}
          <div
            onClick={() => navigate('/mock-home')}
            style={{
              background: 'var(--surface)',
              borderRadius: '18px',
              padding: '14px 12px',
              border: '1.5px solid rgba(124,58,237,0.22)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                fontSize: '8.5px',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.3)',
                color: '#7C3AED',
                padding: '2px 7px',
                borderRadius: '50px'
              }}
            >
              AI CBT
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                background: 'rgba(124,58,237,0.12)',
                color: '#7C3AED'
              }}
            >
              <i className="fa-solid fa-file-pen" />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>Mock Tests</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', fontWeight: 500, marginTop: '2px' }}>
                JEE, NEET &amp; CUET
              </div>
            </div>
          </div>

          {/* Card 2: Focus Timer */}
          <div
            onClick={() => navigate('/timer')}
            style={{
              background: 'var(--surface)',
              borderRadius: '18px',
              padding: '14px 12px',
              border: '1.5px solid rgba(16,185,129,0.22)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981'
              }}
            >
              <i className="fa-solid fa-stopwatch" />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>Focus Timer</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', fontWeight: 500, marginTop: '2px' }}>
                Pomodoro &amp; Live Rooms
              </div>
            </div>
          </div>

          {/* Card 3: Progress Tracker */}
          <div
            onClick={() => navigate('/progress')}
            style={{
              background: 'var(--surface)',
              borderRadius: '18px',
              padding: '14px 12px',
              border: '1.5px solid rgba(249,115,22,0.22)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                background: 'rgba(249,115,22,0.12)',
                color: '#F97316'
              }}
            >
              <i className="fa-solid fa-chart-line" />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>Track Progress</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', fontWeight: 500, marginTop: '2px' }}>
                XP, Ranks &amp; Streaks
              </div>
            </div>
          </div>

          {/* Card 4: Study Playlist */}
          <div
            onClick={() => navigate('/playlist')}
            style={{
              background: 'var(--surface)',
              borderRadius: '18px',
              padding: '14px 12px',
              border: '1.5px solid rgba(239,68,68,0.22)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                fontSize: '8.5px',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#EF4444',
                padding: '2px 7px',
                borderRadius: '50px'
              }}
            >
              No Ads
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                background: 'rgba(239,68,68,0.12)',
                color: '#EF4444'
              }}
            >
              <i className="fa-brands fa-youtube" />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>Study Playlist</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', fontWeight: 500, marginTop: '2px' }}>
                Distraction-free video
              </div>
            </div>
          </div>
        </div>

        {/* Agreement Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: 'var(--text2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>
              I agree to the <a href="/terms.html" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Terms</a> &amp;{' '}
              <a href="/privacy.html" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</a>
            </span>
          </label>
        </div>

        {/* Main CTA Button */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '15px 24px',
            background: 'linear-gradient(135deg, #5B5BF6, #7C3AED)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '15px',
            border: 'none',
            borderRadius: '14px',
            cursor: 'pointer',
            boxShadow: '0 6px 22px rgba(91,91,246,0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '9px',
            transition: 'all 0.2s ease',
            marginTop: '6px'
          }}
        >
          <i className={isReturning ? 'fa-solid fa-door-open' : 'fa-solid fa-rocket'} />
          <span>{isReturning ? 'Continue to App' : 'Get Started Now'}</span>
        </button>
      </div>

      {/* Terms Prompt Popup */}
      {showAgreeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '28px 24px',
              borderRadius: '24px',
              textAlign: 'center',
              maxWidth: '340px',
              width: '100%',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'rgba(91,91,246,0.12)',
                border: '1.5px solid rgba(91,91,246,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: 'var(--accent)',
                margin: '0 auto 14px'
              }}
            >
              <i className="fa-solid fa-shield-halved" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
              One quick step
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.55 }}>
              Please agree to our Terms &amp; Privacy Policy to continue using Study Grid Prep.
            </p>
            <button
              onClick={() => {
                setAgreed(true);
                setShowAgreeModal(false);
              }}
              style={{
                marginTop: '18px',
                width: '100%',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #5B5BF6, #7C3AED)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              I Agree &amp; Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
