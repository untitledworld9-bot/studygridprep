import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, getDocs } from '../services/firebase';

interface TestItem {
  id: string;
  testName: string;
  year?: string;
  shift?: string;
  subjects?: string[];
  totalQuestions?: number;
  durationMinutes?: number;
  isFree?: boolean;
}

export const JeeMockSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openYear, setOpenYear] = useState<string | null>('2024');
  const [selectedModalTest, setSelectedModalTest] = useState<TestItem | null>(null);

  useEffect(() => {
    async function loadJeeTests() {
      try {
        const q = query(collection(db, 'mockTests'), where('examType', '==', 'JEE'));
        const snap = await getDocs(q);
        const list: TestItem[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        }));

        if (list.length > 0) {
          setTests(list);
        } else {
          // Pre-populate standard JEE Main PYQ papers
          setTests([
            { id: 'jee_2024_s1_j27', testName: 'JEE Main 2024 (27 Jan Shift 1)', year: '2024', shift: 'Shift 1', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
            { id: 'jee_2024_s2_j27', testName: 'JEE Main 2024 (27 Jan Shift 2)', year: '2024', shift: 'Shift 2', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
            { id: 'jee_2024_s1_j29', testName: 'JEE Main 2024 (29 Jan Shift 1)', year: '2024', shift: 'Shift 1', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
            { id: 'jee_2023_s1_j24', testName: 'JEE Main 2023 (24 Jan Shift 1)', year: '2023', shift: 'Shift 1', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
            { id: 'jee_2023_s2_j24', testName: 'JEE Main 2023 (24 Jan Shift 2)', year: '2023', shift: 'Shift 2', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
            { id: 'jee_2022_s1_j25', testName: 'JEE Main 2022 (25 Jun Shift 1)', year: '2022', shift: 'Shift 1', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true }
          ]);
        }
      } catch (e) {
        setTests([
          { id: 'jee_2024_s1_j27', testName: 'JEE Main 2024 (27 Jan Shift 1)', year: '2024', shift: 'Shift 1', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true },
          { id: 'jee_2024_s2_j27', testName: 'JEE Main 2024 (27 Jan Shift 2)', year: '2024', shift: 'Shift 2', subjects: ['Physics', 'Chemistry', 'Mathematics'], totalQuestions: 90, durationMinutes: 180, isFree: true }
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadJeeTests();
  }, []);

  const years = ['2024', '2023', '2022'];

  const handleSelectTest = (test: TestItem) => {
    setSelectedModalTest(test);
  };

  const startTest = (selectedSub?: string) => {
    if (!selectedModalTest) return;
    localStorage.setItem('selectedTestId', selectedModalTest.id);
    localStorage.setItem('selectedTestName', selectedModalTest.testName);
    localStorage.setItem('selectedExam', 'JEE Main');
    if (selectedSub) {
      localStorage.setItem('selectedSubjects', JSON.stringify([selectedSub]));
    } else {
      localStorage.setItem('selectedSubjects', JSON.stringify(selectedModalTest.subjects || ['Physics', 'Chemistry', 'Mathematics']));
    }
    setSelectedModalTest(null);
    navigate('/jeeinstructions');
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>JEE Main PYQ Papers</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Full syllabus shift mock tests</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Year Accordions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {years.map(yr => {
          const yearTests = tests.filter(t => t.year === yr);
          const isOpen = openYear === yr;

          return (
            <div
              key={yr}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* Year Header Button */}
              <button
                onClick={() => setOpenYear(isOpen ? null : yr)}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-folder" style={{ color: 'var(--accent)', fontSize: '18px' }} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                      JEE Main {yr}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                      {yearTests.length} Shift Papers Available
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    color: 'var(--text3)',
                    fontSize: '13px',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <i className="fa-solid fa-chevron-right" />
                </div>
              </button>

              {/* Papers inside year */}
              {isOpen && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {yearTests.map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTest(t)}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>
                          {t.testName}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                            {t.shift || 'Full Paper'}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>•</span>
                          <span style={{ fontSize: '10px', color: 'var(--text2)' }}>
                            {t.totalQuestions || 90} Qs • 180 Mins
                          </span>
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
              )}
            </div>
          );
        })}
      </div>

      {/* Subject Mode Selection Modal */}
      {selectedModalTest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '24px',
              padding: '24px 20px',
              maxWidth: '360px',
              width: '100%',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'appFadeIn 0.25s ease'
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
              {selectedModalTest.testName}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '16px' }}>
              Choose whether to attempt the full paper or target a single subject.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => startTest()}
                style={{
                  padding: '13px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <span>Attempt Full Paper (P + C + M)</span>
                <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px' }} />
              </button>

              {['Physics', 'Chemistry', 'Mathematics'].map(sub => (
                <button
                  key={sub}
                  onClick={() => startTest(sub)}
                  style={{
                    padding: '10px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {sub} Only (30 Qs)
                </button>
              ))}
            </div>

            <button
              onClick={() => setSelectedModalTest(null)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'var(--text3)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '6px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
