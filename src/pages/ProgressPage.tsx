import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { computeLevel } from '../services/uwCore';

export const ProgressPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const level = computeLevel(profile.xp || 0);

  // Past 7 days dummy or stored study data
  const days = [
    { day: 'Mon', hours: 2.5 },
    { day: 'Tue', hours: 3.2 },
    { day: 'Wed', hours: 1.8 },
    { day: 'Thu', hours: 4.0 },
    { day: 'Fri', hours: 3.5 },
    { day: 'Sat', hours: 5.0 },
    { day: 'Sun', hours: 2.8 }
  ];

  const maxHours = Math.max(...days.map(d => d.hours), 5);

  return (
    <div className="app-container fade-in">
      {/* Header */}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>My Progress &amp; Analytics</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Consistency tracking and performance</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Top 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>
            Total XP
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>
            {profile.xp || 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>Level {level}</div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>
            Streak
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--orange)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <span>{profile.streak || 0}</span>
            <i className="fa-solid fa-fire" style={{ fontSize: '14px' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>Days Active</div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>
            Goal
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.goal ? profile.goal.split(' ')[0] : 'JEE'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>Target</div>
        </div>
      </div>

      {/* Weekly Hours Bar Graph */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px 16px',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Weekly Study Time</div>
            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Hours spent in focus mode</div>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent)' }}>22.8 hrs</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '20px' }}>
          {days.map(d => {
            const heightPercent = Math.round((d.hours / maxHours) * 100);
            return (
              <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)' }}>{d.hours}h</div>
                <div
                  style={{
                    width: '24px',
                    height: `${heightPercent}%`,
                    borderRadius: '8px 8px 4px 4px',
                    background: 'linear-gradient(180deg, var(--accent), var(--accent2))',
                    transition: 'height 0.4s ease'
                  }}
                />
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)' }}>{d.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subject Distribution */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px 16px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
          Subject Focus Split
        </div>

        {[
          { name: 'Physics', color: '#7C3AED', pct: 40 },
          { name: 'Mathematics', color: '#5B5BF6', pct: 35 },
          { name: 'Chemistry', color: '#10B981', pct: 25 }
        ].map(s => (
          <div key={s.name} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
              <span style={{ color: 'var(--text)' }}>{s.name}</span>
              <span style={{ color: s.color }}>{s.pct}%</span>
            </div>
            <div style={{ height: '7px', background: 'var(--surface2)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: '10px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
