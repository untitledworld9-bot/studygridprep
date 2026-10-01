import React from 'react';
import { useNavigate } from 'react-router-dom';

export const AiAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  const resultData = JSON.parse(localStorage.getItem('lastTestResult') || 'null');

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/result-summary')}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>AI Performance Diagnostic</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Actionable weak-point insights</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* AI Summary Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg,#064E3B 0%,#047857 100%)',
          borderRadius: '22px',
          padding: '22px 18px',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(16,185,129,0.2)',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <i className="fa-solid fa-robot" style={{ fontSize: '18px', color: '#A7F3D0' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#A7F3D0' }}>
            SMART REVIEW ENGINE
          </span>
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
          Exam Strategy Diagnostic
        </h3>
        <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>
          Based on your latest attempt on <strong>{resultData?.testName || 'JEE Main Mock'}</strong>, here are your high-leverage areas to gain +20 marks in your next mock.
        </p>
      </div>

      {/* Weak Areas Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid rgba(239,68,68,0.25)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '16px', color: '#EF4444' }} />
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
            High Negative Mark Traps
          </div>
        </div>

        <ul style={{ paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.6 }}>
          <li>
            <strong>Organic Reaction Intermediates:</strong> Revise Reimer-Tiemann and electrophilic carbocation vs carbene pathways.
          </li>
          <li>
            <strong>Calculus Boundary Limits:</strong> Take care of indeterminate forms (0/0) before applying standard expansions.
          </li>
          <li>
            <strong>SHM Energy Partitioning:</strong> Remember kinetic energy uses (A² - x²), whereas potential energy uses x².
          </li>
        </ul>
      </div>

      {/* Suggested 3-Day Action Plan */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-bullseye" style={{ color: 'var(--accent)' }} />
          <span>Recommended Revision Roadmap:</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
          <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: '12px' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Day 1:</span> Solve 15 targeted PYQs on Electrostatics Gauss Law.
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: '12px' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Day 2:</span> Review Coordination Compounds &amp; Chemical Kinetics formula sheet.
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: '12px' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Day 3:</span> Retake full mock test with 50-minute sectional pacing.
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => navigate('/notes-hub')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '14px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-book-open" />
          <span>Open Revision Notes</span>
        </button>

        <button
          onClick={() => navigate('/solutions')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '14px',
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          View Full Solutions →
        </button>
      </div>
    </div>
  );
};
