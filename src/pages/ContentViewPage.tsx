import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc } from '../services/firebase';

export const ContentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDoc() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'content', id));
        if (snap.exists()) {
          setContent({ id: snap.id, ...snap.data() });
        } else {
          // Fallback content
          setContent({
            id,
            title: 'JEE Main 2027 Complete Preparation Strategy & Roadmap',
            author: 'Study Grid Prep Academic Team',
            date: 'Updated Recent',
            type: 'guide',
            body: `
### 1. Master NCERT Before Advanced Materials
For both JEE Main and NEET, line-by-line understanding of Class 11 & 12 NCERT textbooks in Chemistry and Physics forms the baseline foundation.

### 2. Pacing Your PYQ Problem Solving
Solve past 5 years JEE Main shift question papers under real 3-hour timed conditions. Don't check solutions immediately; attempt each doubt twice.

### 3. Maintain an Error Log Notebook
Note down every question you got wrong during mock tests, alongside the specific concept or formula mistake made. Review this log weekly.
            `
          });
        }
      } catch (e) {
        setContent({
          id,
          title: 'Preparation Guide & Formula Sheet',
          body: 'Study Grid Prep curated notes and guidance for high exam percentile.'
        });
      } finally {
        setLoading(false);
      }
    }
    loadDoc();
  }, [id]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: content?.title || 'Study Grid Prep Guide',
        url: window.location.href
      }).catch(() => {});
    }
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Article View</div>
        </div>

        <button
          onClick={handleShare}
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
          <i className="fa-solid fa-share-nodes" />
        </button>
      </div>

      {content && (
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '20px 18px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--accent)',
              marginBottom: '6px'
            }}
          >
            {content.type || 'Study Article'}
          </div>

          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, marginBottom: '8px' }}>
            {content.title}
          </h1>

          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            {content.author ? `By ${content.author} • ` : ''}{content.date || 'Study Grid Prep'}
          </div>

          <div
            style={{
              fontSize: '13.5px',
              color: 'var(--text)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap'
            }}
          >
            {content.body || content.description}
          </div>
        </article>
      )}
    </div>
  );
};
