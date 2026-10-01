import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const JeeInstructionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const testName = localStorage.getItem('selectedTestName') || 'JEE Main Mock Test';

  const handleProceed = () => {
    if (!agreed) return;
    navigate('/run-test');
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/jeemockselect')}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Examination Instructions</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Please read carefully before proceeding</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Summary Badge */}
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
            <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '14px', marginTop: '2px' }}>180 Minutes</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>MAX MARKS</div>
            <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '14px', marginTop: '2px' }}>300 Marks</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>CORRECT ANSWER</div>
            <div style={{ fontWeight: 800, color: '#10B981', fontSize: '14px', marginTop: '2px' }}>+4 Marks</div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ color: 'var(--text3)', fontWeight: 600 }}>NEGATIVE MARK</div>
            <div style={{ fontWeight: 800, color: '#EF4444', fontSize: '14px', marginTop: '2px' }}>-1 Mark</div>
          </div>
        </div>
      </div>

      {/* Symbol Guidelines */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>
          Question Palette Color Code:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>1</span>
            <span style={{ color: 'var(--text2)' }}>You have answered the question.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>2</span>
            <span style={{ color: 'var(--text2)' }}>You have NOT answered the question.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>3</span>
            <span style={{ color: 'var(--text2)' }}>You have not visited the question yet.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#7C3AED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>4</span>
            <span style={{ color: 'var(--text2)' }}>Marked for review (will NOT be evaluated unless answered).</span>
          </div>
        </div>
      </div>

      {/* Checkbox Agreement */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
        <input
          type="checkbox"
          id="agreeCheck"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', marginTop: '2px', cursor: 'pointer' }}
        />
        <label htmlFor="agreeCheck" style={{ fontSize: '12.5px', color: 'var(--text)', cursor: 'pointer', lineHeight: 1.5 }}>
          I have read and understood all the instructions. All computer hardware, mouse, and internet connection have been verified.
        </label>
      </div>

      {/* Start Button */}
      <button
        onClick={handleProceed}
        disabled={!agreed}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '50px',
          background: agreed ? 'linear-gradient(135deg,#5B5BF6,#7C3AED)' : 'var(--surface2)',
          border: 'none',
          color: agreed ? '#fff' : 'var(--text3)',
          fontSize: '15px',
          fontWeight: 700,
          cursor: agreed ? 'pointer' : 'not-allowed',
          boxShadow: agreed ? '0 6px 20px rgba(91,91,246,0.35)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <span>I Am Ready To Begin</span>
        <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }} />
      </button>
    </div>
  );
};
