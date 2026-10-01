import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addXP } from '../services/uwCore';
import { db, doc, updateDoc, increment } from '../services/firebase';

export const TimerPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [studyMinutesToday, setStudyMinutesToday] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [activeTab, setActiveTab] = useState<'timer' | 'room'>('timer');
  const [buddies] = useState([
    { id: '1', name: 'Aarav S.', status: 'Studying Physics (JEE 2027)', time: '42m', icon: 'fa-solid fa-atom', iconColor: '#7C3AED' },
    { id: '2', name: 'Priya K.', status: 'Organic Chemistry Revision', time: '1h 15m', icon: 'fa-solid fa-flask', iconColor: '#10B981' },
    { id: '3', name: 'Rohan V.', status: 'Solving CUET PYQs', time: '28m', icon: 'fa-solid fa-landmark', iconColor: '#0EA5E9' },
    { id: '4', name: 'Ananya D.', status: 'Maths Integration', time: '55m', icon: 'fa-solid fa-calculator', iconColor: '#F97316' }
  ]);
  const [wavedUsers, setWavedUsers] = useState<Record<string, boolean>>({});

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const savedMin = parseInt(localStorage.getItem('todayFocusTime') || '0', 10);
    setStudyMinutesToday(savedMin);
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (mode === 'pomodoro') {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              handleSessionComplete();
              return 0;
            }
            return prev - 1;
          } else {
            return prev + 1;
          }
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, mode]);

  const handleSessionComplete = async () => {
    setIsRunning(false);
    const completedMinutes = selectedDuration;
    const nextTotal = studyMinutesToday + completedMinutes;
    setStudyMinutesToday(nextTotal);
    localStorage.setItem('todayFocusTime', String(nextTotal));

    // Award +25 XP
    await addXP(25);

    // Sync focus time to firestore
    const uid = profile.uid || localStorage.getItem('userUID');
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          focusTime: increment(completedMinutes)
        });
      } catch (e) {}
    }
  };

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(mode === 'pomodoro' ? selectedDuration * 60 : 0);
  };

  const setPomodoroTime = (mins: number) => {
    setSelectedDuration(mins);
    setIsRunning(false);
    setSecondsLeft(mins * 60);
  };

  const handleWave = (userId: string) => {
    setWavedUsers(prev => ({ ...prev, [userId]: true }));
    setTimeout(() => {
      setWavedUsers(prev => ({ ...prev, [userId]: false }));
    }, 3000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = mode === 'pomodoro'
    ? Math.max(0, Math.min(100, Math.round(((selectedDuration * 60 - secondsLeft) / (selectedDuration * 60)) * 100)))
    : 100;

  return (
    <div className="app-container fade-in">
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Smart Focus Room</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Distraction-Free Study Space</div>
        </div>

        <button
          onClick={() => navigate('/focus')}
          title="Fullscreen Focus"
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
          <i className="fa-solid fa-expand" />
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          background: 'var(--surface2)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '16px',
          border: '1px solid var(--border)'
        }}
      >
        <button
          onClick={() => setActiveTab('timer')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'timer' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'timer' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 700,
            fontSize: '12.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'timer' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.18s ease'
          }}
        >
          ⏱ Focus Timer
        </button>
        <button
          onClick={() => setActiveTab('room')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'room' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'room' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 700,
            fontSize: '12.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'room' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.18s ease'
          }}
        >
          <i className="fa-solid fa-users" style={{ marginRight: '6px' }} />
          Study Buddies (4)
        </button>
      </div>

      {activeTab === 'timer' ? (
        <div style={{ textAlign: 'center' }}>
          {/* Pomodoro Duration Selector */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
            {[15, 25, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => setPomodoroTime(mins)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: selectedDuration === mins ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedDuration === mins ? 'rgba(91,91,246,0.1)' : 'var(--surface)',
                  color: selectedDuration === mins ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer'
                }}
              >
                {mins}m
              </button>
            ))}
          </div>

          {/* Big Circular Timer Dial */}
          <div
            style={{
              position: 'relative',
              width: '240px',
              height: '240px',
              margin: '0 auto 24px',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface)',
              border: '6px solid var(--surface2)',
              boxShadow: isRunning ? '0 10px 40px rgba(91,91,246,0.2)' : 'var(--shadow)'
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-1px',
                fontFamily: 'monospace'
              }}
            >
              {formatTime(secondsLeft)}
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isRunning ? '#10B981' : 'var(--text3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isRunning ? '#10B981' : 'var(--text3)'
                }}
              />
              <span>{isRunning ? 'Focus In Progress' : 'Paused'}</span>
            </div>
          </div>

          {/* Action Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={handleStartPause}
              style={{
                padding: '14px 44px',
                borderRadius: '50px',
                background: isRunning
                  ? 'linear-gradient(135deg,#EF4444,#DC2626)'
                  : 'linear-gradient(135deg,#10B981,#059669)',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isRunning
                  ? '0 6px 20px rgba(239,68,68,0.35)'
                  : '0 6px 20px rgba(16,185,129,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}`} />
              <span>{isRunning ? 'Pause' : 'Start Focus'}</span>
            </button>

            <button
              onClick={handleReset}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="fa-solid fa-rotate-left" />
            </button>
          </div>

          {/* Today Stats Card */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-trophy" style={{ fontSize: '20px', color: '#F59E0B' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Today's Focus Time</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Consistent hours build deep memory</div>
              </div>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
              {studyMinutesToday} mins
            </div>
          </div>
        </div>
      ) : (
        /* Room Tab */
        <div>
          <div
            style={{
              background: 'rgba(91,91,246,0.08)',
              border: '1px solid rgba(91,91,246,0.2)',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '12px',
              color: 'var(--text)',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <i className="fa-solid fa-earth-americas" style={{ fontSize: '16px', color: 'var(--accent)' }} />
            <div>
              <strong>Global Study Grid Room</strong> — Aspirants from across India studying right now.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {buddies.map(b => (
              <div
                key={b.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  <i className={b.icon} style={{ color: b.iconColor }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{b.name}</span>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>{b.status}</div>
                </div>

                <button
                  onClick={() => handleWave(b.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '50px',
                    background: wavedUsers[b.id] ? '#10B981' : 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: wavedUsers[b.id] ? '#fff' : 'var(--text)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {wavedUsers[b.id] ? (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Waved</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-hand" />
                      <span>Wave</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
