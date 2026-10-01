import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

interface SetGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetGoalModal: React.FC<SetGoalModalProps> = ({ isOpen, onClose }) => {
  const { profile, setGoal } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState(profile.goal || 'JEE Main 2027');
  const [examDate, setExamDate] = useState(profile.goalDate || '2026-04-02');

  if (!isOpen) return null;

  const handleSave = async () => {
    await setGoal(selectedGoal, examDate);
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}
    onClose();
  };

  const goals = [
    { id: 'JEE', label: 'JEE', sub: 'Main 2027', icon: 'assets/jee.png', faClass: 'fa-solid fa-atom', color: '#7C3AED' },
    { id: 'NEET', label: 'NEET', sub: 'UG 2027', icon: 'assets/neet.png', faClass: 'fa-solid fa-dna', color: '#10B981' },
    { id: 'CUET', label: 'CUET', sub: 'UG 2027', icon: 'assets/cuet.png', faClass: 'fa-solid fa-landmark', color: '#0EA5E9' },
    { id: 'Boards', label: 'Boards', sub: 'Class 12', icon: '', faClass: 'fa-solid fa-book-open', color: '#F97316' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
          padding: '30px 22px 24px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'appFadeIn 0.3s ease'
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--accent)',
            marginBottom: '6px'
          }}
        >
          <i className="fa-solid fa-bullseye" style={{ marginRight: '6px' }} />
          Target Exam Goal
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
          What's Your Target?
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginBottom: '20px', lineHeight: 1.5 }}>
          Personalize your countdown, mock test tracking & study metrics.
        </p>

        {/* Goal options grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {goals.map(g => {
            const isSel = selectedGoal.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGoal(`${g.label} ${g.sub}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '14px 10px',
                  borderRadius: '16px',
                  background: isSel ? 'rgba(91,91,246,0.1)' : 'var(--surface2)',
                  border: isSel ? '2px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px',
                    background: '#fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                >
                  {g.icon ? (
                    <img
                      src={g.icon}
                      alt={g.label}
                      style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <i className={g.faClass} style={{ fontSize: '22px', color: g.color }} />
                  )}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{g.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{g.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Date input */}
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text2)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              marginBottom: '6px'
            }}
          >
            Exam Target Date
          </label>
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />
        </div>

        {/* Actions */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
            border: 'none',
            color: '#fff',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(91,91,246,0.35)',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>Save Goal</span>
          <i className="fa-solid fa-arrow-right" />
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            fontSize: '12.5px',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
