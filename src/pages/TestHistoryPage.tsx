import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, orderBy, getDocs } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export const TestHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function loadHistory() {
      const uid = profile.uid || localStorage.getItem('userUID');
      if (uid) {
        try {
          const q = query(
            collection(db, 'mockAttempts'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc')
          );
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (list.length > 0) {
            setHistory(list);
            return;
          }
        } catch (e) {}
      }

      // Check localStorage fallback
      const last = localStorage.getItem('lastTestResult');
      if (last) {
        setHistory([JSON.parse(last)]);
      } else {
        setHistory([
          { testName: 'JEE Main 2024 (27 Jan Shift 1)', score: 72, maxScore: 90, totalQuestions: 90, date: '1 Oct 2026' },
          { testName: 'CUET UG General Test Mock 1', score: 145, maxScore: 200, totalQuestions: 60, date: '28 Sep 2026' }
        ]);
      }
    }
    loadHistory();
  }, [profile.uid]);

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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Mock Attempt History</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Past scores &amp; attempts</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {history.map((h, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                {h.testName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                Attempted on {h.date || 'Recent'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)' }}>
                {h.score} pts
              </div>
              <button
                onClick={() => navigate('/result-summary')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 0'
                }}
              >
                Review Score →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
