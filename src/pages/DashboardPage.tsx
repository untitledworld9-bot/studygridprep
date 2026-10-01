import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getXP, getStreak, computeLevel } from '../services/uwCore';

export const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeBanner, setActiveBanner] = useState(0);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);

  useEffect(() => {
    // Load local today focus minutes
    const storedMin = parseInt(localStorage.getItem('todayFocusTime') || '0', 10);
    setTodayFocusMinutes(storedMin);

    // Auto rotate banners every 5 seconds
    const interval = setInterval(() => {
      setActiveBanner(prev => (prev === 0 ? 1 : 0));
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const totalXP = profile.xp || getXP();
  const streak = profile.streak || getStreak();
  const level = computeLevel(totalXP);

  // Daily goal progress (target: 10 XP daily)
  const dailyXP = Math.min(10, totalXP % 100);
  const dailyPercent = Math.min(100, Math.round((dailyXP / 10) * 100));

  return (
    <div className="app-container fade-in">
      {/* ─── BANNER CAROUSEL ─── */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '22px',
          marginBottom: '14px',
          boxShadow: '0 6px 28px rgba(0,0,0,0.14)',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            display: 'flex',
            transform: `translateX(-${activeBanner * 100}%)`,
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Slide 1 — Mock Test */}
          <div
            onClick={() => navigate('/mock-home')}
            style={{
              minWidth: '100%',
              borderRadius: '22px',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              minHeight: '155px',
              position: 'relative',
              background: 'linear-gradient(135deg,#5B2BF6,#8B2FF8,#5B2BF6)'
            }}
          >
            <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.25 }}>
              <i className="fa-solid fa-bullseye" style={{ fontSize: '64px', color: '#fff' }} />
            </div>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
              Full Length PYQs
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '4px', letterSpacing: '-0.3px' }}>
              JEE &amp; CUET Mocks
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, marginBottom: '14px' }}>
              NTA CBT interface with AI analysis
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fff',
                borderRadius: '50px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1A0F40',
                width: 'fit-content',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              <span>Start Mock Test</span>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#5B2BF6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                <i className="fa-solid fa-play" style={{ fontSize: '8px' }} />
              </span>
            </div>
          </div>

          {/* Slide 2 — Focus Session */}
          <div
            onClick={() => navigate('/timer')}
            style={{
              minWidth: '100%',
              borderRadius: '22px',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              minHeight: '155px',
              position: 'relative',
              background: 'linear-gradient(135deg,#4C35F0,#7B3AF7,#4C35F0)'
            }}
          >
            <div style={{ position: 'absolute', right: '16px', bottom: '8px', opacity: 0.25 }}>
              <i className="fa-solid fa-stopwatch" style={{ fontSize: '64px', color: '#fff' }} />
            </div>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
              Virtual Study Room
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '4px', letterSpacing: '-0.3px' }}>
              Smart Focus Timer
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, marginBottom: '14px' }}>
              Study with friends online in real-time
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fff',
                borderRadius: '50px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1A0F40',
                width: 'fit-content',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              <span>Join Room</span>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#4C35F0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                ⏱
              </span>
            </div>
          </div>
        </div>

        {/* Carousel Dots */}
        <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
          <span
            onClick={e => { e.stopPropagation(); setActiveBanner(0); }}
            style={{
              width: activeBanner === 0 ? '16px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: '#fff',
              opacity: activeBanner === 0 ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
          />
          <span
            onClick={e => { e.stopPropagation(); setActiveBanner(1); }}
            style={{
              width: activeBanner === 1 ? '16px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: '#fff',
              opacity: activeBanner === 1 ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* ─── XP & RANK BAR ─── */}
      <div
        onClick={() => navigate('/mainleaderboard')}
        style={{
          display: 'flex',
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          marginBottom: '10px'
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <i className="fa-solid fa-bolt" style={{ fontSize: '18px', color: '#F59E0B' }} />
          <div>
            <div style={{ fontSize: '9.5px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Study XP
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              {totalXP}
            </div>
          </div>
        </div>

        <div style={{ width: '1px', background: 'var(--border)' }} />

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <i className="fa-solid fa-trophy" style={{ fontSize: '18px', color: '#F59E0B' }} />
          <div>
            <div style={{ fontSize: '9.5px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Rank Tier
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              Level {level}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DAILY GOAL / STREAK CARD ─── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>
            <i className="fa-solid fa-fire" style={{ color: 'var(--orange)', fontSize: '14px' }} />
            <span>Daily Goal</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600 }}>
            {dailyXP} / 10 XP
          </div>
        </div>

        {/* Progress line */}
        <div style={{ position: 'relative', height: '8px', background: 'var(--surface2)', borderRadius: '50px', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${dailyPercent}%`,
              borderRadius: '50px',
              background: 'linear-gradient(90deg, #F97316, #F43F5E)',
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '7px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
            Complete study sessions or tasks for +10 XP
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: dailyPercent >= 100 ? '#10B981' : '#F97316' }}>
            {dailyPercent >= 100 ? 'Goal Completed!' : `${100 - dailyPercent}% to go`}
          </span>
        </div>
      </div>

      {/* ─── START STUDY HEADING ─── */}
      <div
        style={{
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: '11px',
          letterSpacing: '-0.2px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span>Start Study</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text3)' }}>— Choose your focus</span>
      </div>

      {/* ─── 2-COLUMN PRIMARY FEATURE CARDS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {/* Mock Test Card */}
        <div
          onClick={() => navigate('/mock-home')}
          style={{
            borderRadius: '20px',
            padding: '16px 14px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            border: '1.5px solid rgba(124,58,237,0.22)',
            transition: 'transform 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg,#7C3AED,#5B2BF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(124,58,237,0.35)'
              }}
            >
              <i className="fa-solid fa-file-pen" />
            </div>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'var(--text3)'
              }}
            >
              <i className="fa-solid fa-chevron-right" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
              Mock Tests
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500 }}>
              PYQs &amp; Full Syllabus
            </div>
            <div style={{ marginTop: '7px', fontSize: '11px', fontWeight: 700, color: '#7C3AED' }}>
              Attempt Test →
            </div>
          </div>
        </div>

        {/* Focus Timer Card */}
        <div
          onClick={() => navigate('/timer')}
          style={{
            borderRadius: '20px',
            padding: '16px 14px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            border: '1.5px solid rgba(16,185,129,0.22)',
            transition: 'transform 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'rgba(16,185,129,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: '#10B981'
              }}
            >
              <i className="fa-solid fa-stopwatch" />
            </div>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'var(--text3)'
              }}
            >
              <i className="fa-solid fa-chevron-right" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
              Focus Room
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500 }}>
              Live Peer Sessions
            </div>
            <div
              style={{
                marginTop: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(16,185,129,0.08)',
                color: '#10B981',
                fontSize: '10.5px',
                fontWeight: 600
              }}
            >
              <span>⏱ {todayFocusMinutes}m today</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM DUO: PLAYLIST & RIGHT TOOLS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {/* Playlist Card */}
        <div
          onClick={() => navigate('/playlist')}
          style={{
            background: 'var(--surface)',
            border: '1.5px solid rgba(239,68,68,0.22)',
            borderRadius: '20px',
            padding: '16px 14px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '150px'
          }}
        >
          <div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '13px',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                fontSize: '18px',
                marginBottom: '10px'
              }}
            >
              <i className="fa-solid fa-play" />
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#EF4444', marginBottom: '2px' }}>
              Study Playlist
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.4 }}>
              Zero-distraction YouTube study
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Watch &amp; Learn</span>
            <span>→</span>
          </div>
        </div>

        {/* Right Tools Column (Analytics & AI Analysis) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Progress / Analytics Card */}
          <div
            onClick={() => navigate('/progress')}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(249,115,22,0.22)',
              borderRadius: '18px',
              padding: '11px 12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'rgba(249,115,22,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F97316',
                fontSize: '16px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-chart-simple" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Progress</div>
              <div style={{ fontSize: '10px', color: 'var(--text2)' }}>Analytics &amp; hours</div>
            </div>
          </div>

          {/* AI Analysis Card */}
          <div
            onClick={() => navigate('/ai-analysis')}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(16,185,129,0.22)',
              borderRadius: '18px',
              padding: '11px 12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
                fontSize: '16px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-robot" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>AI Analysis</div>
              <div style={{ fontSize: '10px', color: 'var(--text2)' }}>Weak areas &amp; tips</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TODO PLANNER RECTANGLE CARD ─── */}
      <div
        onClick={() => navigate('/todo')}
        style={{
          background: 'var(--surface)',
          border: '1.5px solid rgba(14,165,233,0.25)',
          borderRadius: '20px',
          padding: '14px 16px',
          cursor: 'pointer',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '14px'
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(14,165,233,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0EA5E9',
            fontSize: '20px',
            flexShrink: 0
          }}
        >
          <i className="fa-solid fa-list-check" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Daily Todo Planner</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
            Track study chapters &amp; unlock +50 XP daily bonus
          </div>
        </div>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '9px',
            background: 'var(--surface2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text3)',
            fontSize: '11px'
          }}
        >
          <i className="fa-solid fa-chevron-right" />
        </div>
      </div>

      {/* ─── CONTENT HUB & NOTES SHORTCUT ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div
          onClick={() => navigate('/notes-hub')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <i className="fa-solid fa-book-open" style={{ fontSize: '18px', color: '#5B5BF6' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Revision Notes</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text2)' }}>Formula sheets &amp; PDFs</div>
          </div>
        </div>

        <div
          onClick={() => navigate('/college-hub')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <i className="fa-solid fa-landmark" style={{ fontSize: '18px', color: '#0EA5E9' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Colleges</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text2)' }}>Cutoffs &amp; placements</div>
          </div>
        </div>
      </div>
    </div>
  );
};
