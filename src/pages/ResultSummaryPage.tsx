import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';

export const ResultSummaryPage: React.FC = () => {
  const navigate = useNavigate();

  const resultData = JSON.parse(localStorage.getItem('lastTestResult') || 'null') || {
    testName: 'JEE Main Mock Test',
    score: 24,
    maxScore: 36,
    totalQuestions: 9,
    correctCount: 6,
    wrongCount: 2,
    skippedCount: 1,
    date: 'Today'
  };

  useEffect(() => {
    try {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}
  }, []);

  const accuracy = resultData.totalQuestions - resultData.skippedCount > 0
    ? Math.round((resultData.correctCount / (resultData.totalQuestions - resultData.skippedCount)) * 100)
    : 0;

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/mock-home')}
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
          <i className="fa-solid fa-house" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Test Performance Summary</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Result Card &amp; Score Overview</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Main Score Card */}
      <div
        style={{
          background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
          borderRadius: '24px',
          padding: '28px 20px',
          color: '#fff',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(91,91,246,0.3)',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, marginBottom: '4px' }}>
          {resultData.testName}
        </div>

        <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-1px' }}>
          {resultData.score} <span style={{ fontSize: '20px', opacity: 0.75 }}>/ {resultData.maxScore}</span>
        </div>

        <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
          Estimated Percentile: <strong>94.2%</strong>
        </div>
      </div>

      {/* Stat Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '14px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>CORRECT</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', marginTop: '2px' }}>
            {resultData.correctCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)' }}>+{resultData.correctCount * 4} Marks</div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '14px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>INCORRECT</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', marginTop: '2px' }}>
            {resultData.wrongCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)' }}>-{resultData.wrongCount} Negative</div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '14px 10px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>ACCURACY</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', marginTop: '2px' }}>
            {accuracy}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Attempted Qs</div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => navigate('/ai-analysis')}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg,#10B981,#059669)',
            border: 'none',
            color: '#fff',
            fontSize: '14.5px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-robot" />
          <span>View Deep AI Diagnostic Analysis</span>
          <i className="fa-solid fa-arrow-right" />
        </button>

        <button
          onClick={() => navigate('/result-analysis')}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent)' }} />
          <span>Topic-Wise Question Breakdown</span>
        </button>

        <button
          onClick={() => navigate('/solutions')}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-book-open" style={{ color: 'var(--accent)' }} />
          <span>Full Step-by-Step Solutions</span>
        </button>
      </div>
    </div>
  );
};
