import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const NotesViewPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || 'n1';

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/notes-hub')}
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Download Notes</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px'
        }}
      >
        <div style={{ marginBottom: '14px' }}>
          <i className="fa-solid fa-book-open" style={{ fontSize: '42px', color: 'var(--accent)' }} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
          Chapter Formula Sheet &amp; Notes
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginBottom: '20px', lineHeight: 1.5 }}>
          Verified high-yield formulas and concept summaries prepared by top percentile educators.
        </p>

        <a
          href="https://studygridprep.online"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '13px 28px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(91,91,246,0.3)'
          }}
        >
          <i className="fa-solid fa-file-arrow-down" />
          <span>Download PDF Document</span>
        </a>
      </div>
    </div>
  );
};
