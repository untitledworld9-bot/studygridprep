import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, getDocs } from '../services/firebase';

interface NoteItem {
  id: string;
  chapterName: string;
  subject: string;
  pages?: number;
  pdfUrl?: string;
  description?: string;
}

export const NotesHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [notes, setNotes] = useState<NoteItem[]>([]);

  useEffect(() => {
    async function loadNotes() {
      try {
        const q = query(collection(db, 'notes'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (list.length > 0) {
          setNotes(list);
          return;
        }
      } catch (e) {}

      // Fallback notes catalog
      setNotes([
        { id: 'n1', chapterName: 'Electrostatics & Electric Potential', subject: 'Physics', pages: 14, description: 'Coulomb Law, Gauss Theorem, Capacitance & Energy Stored formulas.' },
        { id: 'n2', chapterName: 'Current Electricity & Circuit Laws', subject: 'Physics', pages: 12, description: 'Kirchhoff Laws, Wheatstone Bridge, Meter Bridge & Potentiometer.' },
        { id: 'n3', chapterName: 'Ray & Wave Optics Complete Summary', subject: 'Physics', pages: 16, description: 'Lens makers formula, prism dispersion, Huygens principle & interference.' },
        { id: 'n4', chapterName: 'Coordination Compounds & Bonding', subject: 'Chemistry', pages: 18, description: 'IUPAC nomenclature, CFT, VBT, Isomerism and colour of complexes.' },
        { id: 'n5', chapterName: 'Chemical Kinetics & Rate Laws', subject: 'Chemistry', pages: 10, description: 'Order, molecularity, Arrhenius equation & catalyst effects.' },
        { id: 'n6', chapterName: 'Definite Integration & Area Under Curves', subject: 'Maths', pages: 15, description: 'All fundamental integral properties, Leibniz theorem and standard curves.' },
        { id: 'n7', chapterName: 'Matrices & Determinants Cheat Sheet', subject: 'Maths', pages: 11, description: 'Adjoint properties, Cramer rule, symmetric and skew-symmetric matrices.' }
      ]);
    }
    loadNotes();
  }, []);

  const filteredNotes = notes.filter(n => n.subject.toLowerCase() === selectedSubject.toLowerCase());

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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Notes &amp; Formula Hub</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>High-Yield NCERT &amp; PYQ Revision PDFs</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Subject Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px' }}>
        {['Physics', 'Chemistry', 'Maths'].map(sub => (
          <button
            key={sub}
            onClick={() => setSelectedSubject(sub)}
            style={{
              padding: '7px 18px',
              borderRadius: '50px',
              border: selectedSubject === sub ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: selectedSubject === sub ? 'rgba(91,91,246,0.1)' : 'var(--surface)',
              color: selectedSubject === sub ? 'var(--accent)' : 'var(--text2)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Notes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredNotes.map(n => (
          <div
            key={n.id}
            onClick={() => navigate(`/notes-view?id=${encodeURIComponent(n.id)}`)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '16px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'transform 0.15s ease'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(91,91,246,0.1)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-file-pdf" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                {n.chapterName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px', lineHeight: 1.4 }}>
                {n.description}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text3)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className="fa-solid fa-file-lines" />
                <span>{n.pages || 12} Pages • High Yield Summary</span>
              </div>
            </div>

            <div style={{ color: 'var(--accent)', fontSize: '14px' }}>
              <i className="fa-solid fa-arrow-down" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
