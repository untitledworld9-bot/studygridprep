import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const FocusPage: React.FC = () => {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => (s > 0 ? s - 1 : 0));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeStr = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#070B14',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '24px'
      }}
    >
      <button
        onClick={() => navigate('/timer')}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          borderRadius: '12px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <i className="fa-solid fa-arrow-left" />
      </button>

      <div style={{ textAlign: 'center', animation: 'appFadeIn 0.4s ease' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '10px'
          }}
        >
          ZEN FOCUS MODE
        </div>

        <div
          style={{
            fontSize: '76px',
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '-2px',
            marginBottom: '20px',
            textShadow: '0 0 40px rgba(91,91,246,0.3)'
          }}
        >
          {timeStr}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              padding: '14px 40px',
              borderRadius: '50px',
              background: isRunning ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
              border: `1.5px solid ${isRunning ? '#EF4444' : '#10B981'}`,
              color: isRunning ? '#EF4444' : '#10B981',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
    </div>
  );
};
