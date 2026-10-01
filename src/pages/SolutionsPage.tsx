import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SolutionsPage: React.FC = () => {
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Step-by-Step Solutions</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Explanations for all questions</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Solutions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {details.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text3)' }}>
            No recent test questions found.
          </div>
        ) : (
          details.map((q: any, i: number) => {
            const isCorrect = q.isCorrect;
            const isAttempted = q.isAttempted;

            return (
              <div
                key={i}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '18px',
                  padding: '16px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                      Question {i + 1}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                      {q.subject}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isCorrect ? '#10B981' : isAttempted ? '#EF4444' : 'var(--text3)',
                      background: isCorrect ? 'rgba(16,185,129,0.1)' : isAttempted ? 'rgba(239,68,68,0.1)' : 'var(--surface2)',
                      padding: '2px 8px',
                      borderRadius: '50px'
                    }}
                  >
                    {isCorrect ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-check" /> Correct
                      </span>
                    ) : isAttempted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-xmark" /> Incorrect
                      </span>
                    ) : (
                      'Skipped'
                    )}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55, marginBottom: '12px' }}>
                  {q.questionText}
                </div>

                {/* Option list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  {q.options?.map((opt: string, optIdx: number) => {
                    const isRight = optIdx === q.correctOption;
                    const isUserPick = optIdx === q.userAnswer;

                    let optBg = 'var(--surface2)';
                    let optBorder = '1px solid var(--border)';
                    if (isRight) {
                      optBg = 'rgba(16,185,129,0.12)';
                      optBorder = '1.5px solid #10B981';
                    } else if (isUserPick && !isRight) {
                      optBg = 'rgba(239,68,68,0.1)';
                      optBorder = '1.5px solid #EF4444';
                    }

                    return (
                      <div
                        key={optIdx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: optBg,
                          border: optBorder,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + optIdx)}.</span>
                        <span style={{ flex: 1 }}>{opt}</span>
                        {isRight && (
                          <span style={{ color: '#10B981', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-check" /> Correct Option
                          </span>
                        )}
                        {isUserPick && !isRight && (
                          <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '11px' }}>Your Choice</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                <div
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    borderLeft: '3px solid var(--accent)'
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-lightbulb" />
                    <span>Detailed Solution:</span>
                  </div>
                  <div style={{ color: 'var(--text)', lineHeight: 1.55 }}>
                    {q.explanation || 'Apply standard NCERT theory and direct mathematical simplification.'}
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
