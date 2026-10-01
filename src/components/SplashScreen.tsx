import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, minDuration = 700 }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this tab session
    const hasShown = sessionStorage.getItem('sgp_splash_shown');
    if (hasShown) {
      setIsVisible(false);
      if (onFinish) onFinish();
      return;
    }

    const timer = setTimeout(() => {
      setIsFading(true);
      sessionStorage.setItem('sgp_splash_shown', 'true');
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 420);
      return () => clearTimeout(removeTimer);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isFading ? 0 : 1,
        transform: isFading ? 'scale(1.05)' : 'scale(1)',
        transition: 'opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1), transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isFading ? 'none' : 'all'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'splashPopIn 0.35s ease-out'
        }}
      >
        {/* Glow & Logo */}
        <div style={{ position: 'relative', width: '88px', height: '88px', marginBottom: '20px' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-14px',
              borderRadius: '34px',
              background: 'radial-gradient(circle, rgba(91,91,246,0.45) 0%, rgba(124,58,237,0) 70%)',
              animation: 'splashPulse 2.2s infinite alternate ease-in-out',
              pointerEvents: 'none'
            }}
          />
          <img
            src="/icon-192.png"
            alt="Study Grid Prep"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '24px',
              boxShadow: '0 12px 32px rgba(91,91,246,0.36)',
              objectFit: 'cover',
              position: 'relative',
              zIndex: 2,
              animation: 'splashFloat 2.6s ease-in-out infinite alternate'
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Title & Tagline */}
        <div
          style={{
            fontSize: '23px',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
            marginBottom: '4px'
          }}
        >
          Study Grid Prep
        </div>
        <div
          style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.9px',
            textTransform: 'uppercase',
            marginBottom: '24px'
          }}
        >
          Smart Study Platform
        </div>

        {/* Sleek App Loader */}
        <div
          style={{
            width: '130px',
            height: '4px',
            background: 'var(--surface2)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid var(--border)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              height: '100%',
              width: '45%',
              background: 'linear-gradient(90deg, #5B5BF6, #7C3AED, #10B981)',
              borderRadius: '10px',
              animation: 'splashBar 1.25s infinite ease-in-out'
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashPopIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes splashPulse {
          0% { transform: scale(0.92); opacity: 0.45; }
          100% { transform: scale(1.2); opacity: 0.85; }
        }
        @keyframes splashFloat {
          0% { transform: translateY(0); }
          100% { transform: translateY(-6px); }
        }
        @keyframes splashBar {
          0% { left: -50%; width: 30%; }
          50% { width: 55%; }
          100% { left: 100%; width: 30%; }
        }
      `}</style>
    </div>
  );
};
