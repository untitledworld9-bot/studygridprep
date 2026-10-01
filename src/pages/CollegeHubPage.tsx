import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, getDocs } from '../services/firebase';

interface College {
  id: string;
  name: string;
  location?: string;
  tags?: string[];
  logoUrl?: string;
  highestPackage?: string;
  avgPackage?: string;
  nirf?: number;
}

export const CollegeHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState<College[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadColleges() {
      try {
        const q = query(collection(db, 'collegeInfo'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (list.length > 0) {
          setColleges(list);
          return;
        }
      } catch (e) {}

      // Fallback colleges
      setColleges([
        { id: 'iit_bombay', name: 'IIT Bombay - Indian Institute of Technology', location: 'Mumbai, Maharashtra', tags: ['IIT', 'B.Tech', 'NIRF #3', 'JEE Advanced'], highestPackage: '1.68 CPA', avgPackage: '21.8 LPA', nirf: 3 },
        { id: 'iit_delhi', name: 'IIT Delhi - Indian Institute of Technology', location: 'New Delhi', tags: ['IIT', 'B.Tech', 'NIRF #2', 'JEE Advanced'], highestPackage: '2.0 CPA', avgPackage: '20.5 LPA', nirf: 2 },
        { id: 'nit_trichy', name: 'NIT Trichy - National Institute of Technology', location: 'Tiruchirappalli, Tamil Nadu', tags: ['NIT', 'B.Tech', 'NIRF #9', 'JEE Main'], highestPackage: '52 LPA', avgPackage: '15.4 LPA', nirf: 9 },
        { id: 'du_srcc', name: 'SRCC - Shri Ram College of Commerce (DU)', location: 'Delhi', tags: ['CUET UG', 'Commerce', 'B.Com', 'NIRF #1'], highestPackage: '35 LPA', avgPackage: '10.5 LPA', nirf: 1 }
      ]);
    }
    loadColleges();
  }, []);

  const filtered = colleges.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button
          onClick={() => navigate('/content-hub')}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>College Hub</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Cutoffs, Fees, Placements &amp; Reviews</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '14px',
            padding: '10px 14px'
          }}
        >
          <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text3)', fontSize: '13px' }} />
          <input
            type="text"
            placeholder="Search college, IIT, NIT, CUET tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text)'
            }}
          />
        </div>
      </div>

      {/* College List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={() => navigate(`/college-view?id=${encodeURIComponent(c.id)}`)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '16px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(249,115,22,0.1)',
                  color: 'var(--orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-graduation-cap" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                  {c.location || 'India'}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {(c.tags || []).slice(0, 4).map(t => (
                <span
                  key={t}
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'var(--surface2)',
                    color: 'var(--text2)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* CTC highlights */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text2)' }}>
                Avg Package: <strong style={{ color: 'var(--text)' }}>{c.avgPackage || '18 LPA'}</strong>
              </span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                View Cutoffs →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
