import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, getDocs } from '../services/firebase';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  excerpt?: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  slug?: string;
}

export const ContentHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadContent() {
      try {
        const q = query(collection(db, 'content'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (list.length > 0) {
          setItems(list);
          return;
        }
      } catch (e) {}

      // Fallback articles
      setItems([
        {
          id: '1',
          title: 'JEE Main 2027 Complete Preparation Strategy & Roadmap',
          type: 'guide',
          excerpt: 'Step-by-step 2-year strategy for Class 11 and 12 aspirants covering syllabus pacing and mock schedules.',
          category: 'JEE'
        },
        {
          id: '2',
          title: 'Electrostatics & Gauss Law Complete Formula Sheet PDF',
          type: 'formula-sheet',
          excerpt: 'All high-yield formulas, charge densities, spherical shell potentials & electric flux theorems.',
          category: 'Physics'
        },
        {
          id: '3',
          title: 'CUET UG 2027 General Test Syllabus, Pattern & Best Books',
          type: 'exam-update',
          excerpt: 'Complete breakdown of Section III questions, quantitative aptitude, reasoning and general awareness.',
          category: 'CUET'
        },
        {
          id: '4',
          title: 'Top IITs & NITs Computer Science Engineering Cutoffs Analysis',
          type: 'college',
          excerpt: 'Opening and closing ranks for CSE across top institutes from JoSAA counseling data.',
          category: 'College'
        }
      ]);
    }
    loadContent();
  }, []);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'notes', label: 'Notes' },
    { id: 'formula-sheet', label: 'Formula Sheets' },
    { id: 'guide', label: 'Prep Guides' },
    { id: 'exam-update', label: 'Exam Updates' }
  ];

  const filteredItems = items.filter(item => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button
          onClick={() => navigate('/dashboard-home')}
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Study Content Hub</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Guides, Notes, Formula Sheets &amp; Updates</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Quick shortcuts to Notes Hub and College Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div
          onClick={() => navigate('/notes-hub')}
          style={{
            background: 'var(--surface)',
            border: '1.5px solid rgba(91,91,246,0.22)',
            borderRadius: '16px',
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <i className="fa-solid fa-book-open" style={{ fontSize: '20px', color: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>Notes Hub</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text2)' }}>Free PDF Downloads</div>
          </div>
        </div>

        <div
          onClick={() => navigate('/college-hub')}
          style={{
            background: 'var(--surface)',
            border: '1.5px solid rgba(249,115,22,0.22)',
            borderRadius: '16px',
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <i className="fa-solid fa-landmark" style={{ fontSize: '20px', color: '#F97316' }} />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>College Hub</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text2)' }}>Cutoffs &amp; Placements</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '14px' }}>
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
            placeholder="Search notes, chapters, topics..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '50px',
              border: activeFilter === f.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: activeFilter === f.id ? 'rgba(91,91,246,0.1)' : 'var(--surface)',
              color: activeFilter === f.id ? 'var(--accent)' : 'var(--text2)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Articles list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.map(item => (
          <div
            key={item.id}
            onClick={() => navigate(`/content/${item.id}`)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', background: 'rgba(91,91,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {item.type || 'Article'}
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>{item.category || 'General'}</span>
            </div>

            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px', lineHeight: 1.35 }}>
              {item.title}
            </div>

            <p style={{ fontSize: '11.5px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '10px' }}>
              {item.excerpt || item.description}
            </p>

            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Read Content</span>
              <span>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
