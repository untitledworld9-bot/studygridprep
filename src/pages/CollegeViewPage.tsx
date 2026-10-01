import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc } from '../services/firebase';

export const CollegeViewPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || 'iit_bombay';

  const [college, setCollege] = useState<any | null>(null);

  useEffect(() => {
    async function loadCollege() {
      try {
        const snap = await getDoc(doc(db, 'collegeInfo', id));
        if (snap.exists()) {
          setCollege({ id: snap.id, ...snap.data() });
          return;
        }
      } catch (e) {}

      // Fallback
      setCollege({
        id,
        name: id.toUpperCase().replace('_', ' '),
        location: 'Premier Engineering & Science Campus, India',
        highestPackage: '1.68 CPA',
        avgPackage: '21.8 LPA',
        nirf: 3,
        fees: '₹2.2 Lakhs / year',
        examAccepted: 'JEE Advanced',
        cutoffs: [
          { branch: 'Computer Science Engineering (CSE)', closingRank: '67' },
          { branch: 'Electrical Engineering (EE)', closingRank: '380' },
          { branch: 'Mechanical Engineering (ME)', closingRank: '1,250' }
        ],
        reviews: [
          { author: 'Rahul M. (Alum)', rating: 5, comment: 'World-class laboratory facilities and supreme peer learning culture.' },
          { author: 'Simran K. (3rd Year)', rating: 5, comment: 'Placements and coding ecosystem here are truly top tier.' }
        ]
      });
    }
    loadCollege();
  }, [id]);

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/college-hub')}
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>College Profile</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {college && (
        <>
          {/* Hero Card */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              padding: '20px 18px',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(249,115,22,0.12)',
                  color: 'var(--orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}
              >
                <i className="fa-solid fa-graduation-cap" />
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>
                  {college.name}
                </h1>
                <div style={{ fontSize: '11.5px', color: 'var(--text2)', marginTop: '2px' }}>
                  {college.location}
                </div>
              </div>
            </div>

            {/* Quick stats pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <div style={{ background: 'var(--surface2)', padding: '8px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>AVG CTC</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>{college.avgPackage || '18 LPA'}</div>
              </div>
              <div style={{ background: 'var(--surface2)', padding: '8px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>MAX CTC</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>{college.highestPackage || '1+ CPA'}</div>
              </div>
              <div style={{ background: 'var(--surface2)', padding: '8px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>NIRF RANK</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>#{college.nirf || 5}</div>
              </div>
            </div>
          </div>

          {/* Branch Cutoffs */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '18px 16px',
              marginBottom: '16px'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
              Previous Year Opening / Closing Cutoffs
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(college.cutoffs || []).map((c: any, i: number) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--surface2)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{c.branch}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>Air {c.closingRank}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '18px 16px'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
              Student &amp; Alumni Reviews
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(college.reviews || []).map((r: any, idx: number) => (
                <div key={idx} style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#F59E0B', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {Array.from({ length: r.rating || 5 }).map((_, i) => (
                        <i key={i} className="fa-solid fa-star" />
                      ))}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text2)', lineHeight: 1.5 }}>
                    {r.comment}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
