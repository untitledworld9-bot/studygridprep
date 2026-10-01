import React from 'react';
import { useNavigate } from 'react-router-dom';

export const MockHomePage: React.FC = () => {
  const navigate = useNavigate();

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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Mock Tests Portal</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>NTA Pattern CBT Examination Suite</div>
        </div>

        <button
          onClick={() => navigate('/testhistory')}
          title="Attempt History"
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
          <i className="fa-solid fa-clock-rotate-left" />
        </button>
      </div>

      {/* Target Exam Selection Cards */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>
          Select Your Exam
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* JEE Main */}
          <div
            onClick={() => navigate('/jeemockselect')}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(124,58,237,0.3)',
              borderRadius: '20px',
              padding: '16px 18px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'transform 0.18s ease'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#fff',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flexShrink: 0
              }}
            >
              <img
                src="assets/jee.png"
                alt="JEE Main"
                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>JEE Main</span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '50px', background: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}>
                  2024–2021 PYQs
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text2)', marginTop: '2px' }}>
                Physics, Chemistry &amp; Mathematics with NTA Marking (+4, -1)
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '13px' }}>
              <i className="fa-solid fa-chevron-right" />
            </div>
          </div>

          {/* CUET UG */}
          <div
            onClick={() => navigate('/cuetmockselect')}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(14,165,233,0.3)',
              borderRadius: '20px',
              padding: '16px 18px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'transform 0.18s ease'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#fff',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flexShrink: 0
              }}
            >
              <img
                src="assets/cuet.png"
                alt="CUET UG"
                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>CUET UG</span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '50px', background: 'rgba(14,165,233,0.12)', color: '#0EA5E9' }}>
                  Domain Tests
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text2)', marginTop: '2px' }}>
                General Test, English, Science, Commerce &amp; Humanities
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '13px' }}>
              <i className="fa-solid fa-chevron-right" />
            </div>
          </div>
        </div>
      </div>

      {/* CBT Environment Info */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <i className="fa-solid fa-desktop" style={{ color: 'var(--accent)', fontSize: '16px' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            Exact NTA Screen Environment
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.55 }}>
          Our computer-based test runner mimics real exam palettes, sectional timings, negative marking penalties, and review toggles so you feel 100% prepared on test day.
        </p>
      </div>

      {/* Quick Link to Test History */}
      <div
        onClick={() => navigate('/testhistory')}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--accent)' }} />
          <span>View Previous Attempts &amp; Solutions</span>
        </div>
        <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px', color: 'var(--text3)' }} />
      </div>
    </div>
  );
};
