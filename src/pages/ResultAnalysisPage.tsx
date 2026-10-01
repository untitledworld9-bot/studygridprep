import React from 'react';
import { useNavigate } from 'react-router-dom';

export const ResultAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  const resultData = JSON.parse(localStorage.getItem('lastTestResult') || 'null');
  const details = resultData?.analysisDetails || [];

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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Question Breakdown</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Topic-wise analysis &amp; accuracy</div>
        </div>

        <button
          onClick={() => navigate('/solutions')}
          style={{
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Solutions
        </button>
      </div>

      {/* Questions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {details.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text3)' }}>
            No recent test data found. Attempt a mock test to see performance breakdown!
          </div>
        ) : (
          details.map((q: any, i: number) => {
            const isCorrect = q.isCorrect;
            const isAttempted = q.isAttempted;

            let badgeColor = '#EF4444';
            let badgeBg = 'rgba(239,68,68,0.12)';
            let label = 'Incorrect (-1)';

            if (!isAttempted) {
              badgeColor = 'var(--text3)';
              badgeBg = 'var(--surface2)';
              label = 'Skipped (0)';
            } else if (isCorrect) {
              badgeColor = '#10B981';
              badgeBg = 'rgba(16,185,129,0.12)';
              label = 'Correct (+4)';
            }

            return (
              <div
                key={i}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '14px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text)' }}>
                      Q{i + 1}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: '4px' }}>
                      {q.subject}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: badgeColor,
                      background: badgeBg,
                      padding: '3px 8px',
                      borderRadius: '50px'
                    }}
                  >
                    {label}
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
                  {q.questionText}
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', color: 'var(--text2)' }}>
                  <div>
                    Your Option: <strong>{q.userAnswer !== null ? String.fromCharCode(65 + q.userAnswer) : '—'}</strong>
                  </div>
                  <div>•</div>
                  <div>
                    Correct: <strong style={{ color: '#10B981' }}>{String.fromCharCode(65 + q.correctOption)}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
