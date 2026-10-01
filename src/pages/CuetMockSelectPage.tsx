import React from 'react';
import { useNavigate } from 'react-router-dom';

export const CuetMockSelectPage: React.FC = () => {
  const navigate = useNavigate();

  const cuetSubjects = [
    { id: 'cuet_gt', name: 'General Test (Section III)', questions: 60, time: 60, iconClass: 'fa-solid fa-brain', iconColor: '#7C3AED', desc: 'Current Affairs, GK, Numerical Ability, Reasoning' },
    { id: 'cuet_eng', name: 'English Language (Section IA)', questions: 50, time: 45, iconClass: 'fa-solid fa-book-open', iconColor: '#0EA5E9', desc: 'Reading Comprehension, Vocabulary, Synonyms & Antonyms' },
    { id: 'cuet_phy', name: 'Physics (Domain Subject)', questions: 50, time: 60, iconClass: 'fa-solid fa-atom', iconColor: '#5B5BF6', desc: 'Class 12 NCERT Mechanics, Optics, Modern Physics' },
    { id: 'cuet_chem', name: 'Chemistry (Domain Subject)', questions: 50, time: 60, iconClass: 'fa-solid fa-flask', iconColor: '#10B981', desc: 'Physical, Inorganic and Organic Chemistry' },
    { id: 'cuet_math', name: 'Mathematics / Applied Maths', questions: 50, time: 60, iconClass: 'fa-solid fa-calculator', iconColor: '#F97316', desc: 'Matrices, Determinants, Calculus, Vectors' },
    { id: 'cuet_eco', name: 'Economics / Business Economics', questions: 50, time: 45, iconClass: 'fa-solid fa-chart-pie', iconColor: '#EC4899', desc: 'Macroeconomics, Microeconomics, Indian Economic Development' }
  ];

  const handleSelect = (sub: typeof cuetSubjects[0]) => {
    localStorage.setItem('selectedTestId', sub.id);
    localStorage.setItem('selectedTestName', sub.name);
    localStorage.setItem('selectedExam', 'CUET UG');
    localStorage.setItem('selectedSubjects', JSON.stringify([sub.name]));
    navigate('/cuetinstructions');
  };

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
          <i className="fa-solid fa-arrow-left" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>CUET UG Mock Tests</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Section I, II &amp; III Domain Tests</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {cuetSubjects.map(s => (
          <div
            key={s.id}
            onClick={() => handleSelect(s)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.15s ease'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'var(--surface2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              <i className={s.iconClass} style={{ color: s.iconColor }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                {s.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px', lineHeight: 1.4 }}>
                {s.desc}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600, marginTop: '4px' }}>
                {s.questions} Questions • {s.time} Minutes
              </div>
            </div>

            <div
              style={{
                padding: '6px 12px',
                borderRadius: '50px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: 700
              }}
            >
              Start
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
