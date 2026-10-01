import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginAsGuest } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [typedText, setTypedText] = useState('');
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);

  // Typing effect matching original login.html
  useEffect(() => {
    const fullText = 'Welcome to Study Grid Prep';
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 65);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setIsUnauthorizedDomain(false);
    try {
      await loginWithGoogle();
      const isReturning = localStorage.getItem('returningUser') === 'yes';
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (isPWA && !isReturning) {
        navigate('/mainwelcome');
      } else {
        navigate('/dashboard-home');
      }
    } catch (err: any) {
      setIsLoading(false);
      if (err?.code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomain(true);
        setErrorMsg(`Domain ${window.location.hostname} is not in Firebase Authorized Domains yet.`);
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. Please complete the login.');
      } else if (err?.code === 'auth/network-request-failed') {
        setErrorMsg('Network error. Please check your internet connection.');
      } else {
        setErrorMsg('Login failed. Please try again.');
      }
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    await loginAsGuest('Ayush Gupta', 'ayushgupt640@gmail.com');
    const isReturning = localStorage.getItem('returningUser') === 'yes';
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isPWA && !isReturning) {
      navigate('/mainwelcome');
    } else {
      navigate('/dashboard-home');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg)',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* Theme toggle button at top right */}
      <button
        onClick={() => setThemeMode(mode === 'dark' ? 'light' : 'dark')}
        style={{
          position: 'fixed',
          top: '18px',
          right: '18px',
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 10
        }}
        title="Toggle Theme"
        aria-label="Toggle Theme"
      >
        <i className={mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
      </button>

      {/* Main Login Box */}
      <div style={{ textAlign: 'center', maxWidth: '360px', width: '100%' }}>
        {/* Logo Wrap */}
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '30px',
                background: 'radial-gradient(circle, rgba(91,91,246,0.35) 0%, rgba(124,58,237,0) 70%)',
                animation: 'pulseGlow 2.5s infinite alternate ease-in-out',
                pointerEvents: 'none'
              }}
            />
            <img
              src="/icon-512.png"
              alt="Study Grid Prep"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '22px',
                boxShadow: 'var(--shadow-md)',
                objectFit: 'cover',
                border: '1px solid var(--border)',
                position: 'relative',
                zIndex: 2,
                animation: 'floatLogo 3.5s ease-in-out infinite'
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icon-192.png';
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.4px',
                minHeight: '32px',
                lineHeight: 1.25
              }}
            >
              <span>{typedText}</span>
              <span
                style={{
                  display: 'inline-block',
                  color: 'var(--accent)',
                  animation: 'blinkCursor 0.75s step-end infinite'
                }}
              >
                |
              </span>
            </h1>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}
            >
              Smart Study Platform
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px', lineHeight: 1.55 }}>
              Study Smarter. Score Better.
            </p>
          </div>
        </div>

        {/* Login Card with subtle glassmorphism */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '22px',
            padding: '24px 20px',
            boxShadow: 'var(--shadow)',
            marginBottom: '18px',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        >
          {/* Top subtle gradient line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #5B5BF6, #7C3AED, #10B981)'
            }}
          />

          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--text3)',
              marginBottom: '14px'
            }}
          >
            Sign in to continue
          </div>

          {/* Google Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '11px',
              width: '100%',
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #5B5BF6, #7C3AED)',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              fontWeight: 700,
              fontSize: '14.5px',
              cursor: isLoading ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 6px 20px rgba(91,91,246,0.35)',
              letterSpacing: '0.2px',
              opacity: isLoading ? 0.8 : 1
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                style={{ width: '16px', height: '16px', display: 'block' }}
              />
            </span>
            <span>{isLoading ? 'Signing in…' : 'Continue with Google'}</span>
          </button>

          {/* Quick Preview Login */}
          <div style={{ marginTop: '10px' }}>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isLoading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'opacity 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-flask" style={{ fontSize: '11px' }} />
              <span>Continue as Preview / Tester Account</span>
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '14px 0',
              fontSize: '11px',
              color: 'var(--text3)',
              fontWeight: 600
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span>Secure Login</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '11.5px',
              color: 'var(--text2)',
              fontWeight: 500,
              textAlign: 'left'
            }}
          >
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)', fontSize: '13px', flexShrink: 0 }} />
            <span>Your data is safe. We use Google Sign-In — no password needed.</span>
          </div>

          {/* Error toast */}
          {errorMsg && (
            <div
              style={{
                marginTop: '14px',
                padding: '12px 16px',
                background: isUnauthorizedDomain ? 'rgba(91,91,246,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${isUnauthorizedDomain ? 'rgba(91,91,246,0.3)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: '12px',
                color: isUnauthorizedDomain ? 'var(--text)' : 'var(--red)',
                fontSize: '12px',
                fontWeight: 500,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className={isUnauthorizedDomain ? 'fa-solid fa-circle-info' : 'fa-solid fa-circle-exclamation'} style={{ color: isUnauthorizedDomain ? 'var(--accent)' : 'var(--red)', fontSize: '13px' }} />
                <span>{errorMsg}</span>
              </div>
              {isUnauthorizedDomain && (
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #5B5BF6, #7C3AED)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Continue with Preview Account
                </button>
              )}
            </div>
          )}
        </div>

        {/* Feature Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '7px', marginBottom: '20px' }}>
          <span style={pillStyle}>
            <i className="fa-solid fa-file-pen" style={{ color: '#7C3AED', fontSize: '10px' }} /> Mock Tests
          </span>
          <span style={pillStyle}>
            <i className="fa-solid fa-stopwatch" style={{ color: '#10B981', fontSize: '10px' }} /> Focus Timer
          </span>
          <span style={pillStyle}>
            <i className="fa-brands fa-youtube" style={{ color: '#EF4444', fontSize: '10px' }} /> YT Playlist
          </span>
          <span style={pillStyle}>
            <i className="fa-solid fa-list-check" style={{ color: 'var(--accent)', fontSize: '10px' }} /> Todo List
          </span>
          <span style={pillStyle}>
            <i className="fa-solid fa-trophy" style={{ color: '#F97316', fontSize: '10px' }} /> Leaderboard
          </span>
          <span style={pillStyle}>
            <i className="fa-solid fa-robot" style={{ color: '#10B981', fontSize: '10px' }} /> AI Analysis
          </span>
        </div>

        {/* Footer */}
        <p style={{ fontSize: '11.5px', color: 'var(--text3)', lineHeight: 1.6 }}>
          By continuing you agree to our{' '}
          <a href="/terms.html" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Terms
          </a>{' '}
          &amp;{' '}
          <a href="/privacy.html" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Privacy Policy
          </a>
        </p>
      </div>

      <style>{`
        @keyframes floatLogo {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.9); opacity: 0.4; }
          100% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes blinkCursor {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text2)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '50px',
  padding: '5px 12px',
  boxShadow: 'var(--shadow-sm)'
};
