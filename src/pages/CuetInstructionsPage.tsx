import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const CuetInstructionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const testName = localStorage.getItem('selectedTestName') || 'CUET UG Mock Test';

  const handleProceed = () => {
    if (!agreed) return;
    navigate('/run-test');
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/cuetmockselect')}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>CUET UG Guidelines</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>NTA Pattern Rules</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
          {testName}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>DURATION</div>
            <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '14px', marginTop: '2px' }}>60 Minutes</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>MAX MARKS</div>
            <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '14px', marginTop: '2px' }}>200 Marks</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>CORRECT ANSWER</div>
            <div style={{ fontWeight: 800, color: '#10B981', fontSize: '14px', marginTop: '2px' }}>+5 Marks</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>NEGATIVE MARK</div>
            <div style={{ fontWeight: 800, color: '#EF4444', fontSize: '14px', marginTop: '2px' }}>-1 Mark</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
        <input
          type="checkbox"
          id="agreeCheckCuet"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', marginTop: '2px', cursor: 'pointer' }}
        />
        <label htmlFor="agreeCheckCuet" style={{ fontSize: '12.5px', color: 'var(--text)', cursor: 'pointer', lineHeight: 1.5 }}>
          I have read and understood all CUET examination instructions.
        </label>
      </div>

      <button
        onClick={handleProceed}
        disabled={!agreed}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '50px',
          background: agreed ? 'linear-gradient(135deg,#0EA5E9,#2563EB)' : 'var(--surface2)',
          border: 'none',
          color: agreed ? '#fff' : 'var(--text3)',
          fontSize: '15px',
          fontWeight: 700,
          cursor: agreed ? 'pointer' : 'not-allowed',
          boxShadow: agreed ? '0 6px 20px rgba(14,165,233,0.35)' : 'none'
        }}
      >
        <span>Start CUET Test</span>
        <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }} />
      </button>
    </div>
  );
};
