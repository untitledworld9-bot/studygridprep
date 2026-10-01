import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

interface StreakMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StreakMilestoneModal: React.FC<StreakMilestoneModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const streak = profile.streak || 1;

  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(160deg,#1e1b4b,#0f172a)',
          borderRadius: '26px',
          padding: '36px 24px 28px',
          maxWidth: '350px',
          width: '100%',
          textAlign: 'center',
          border: '1.5px solid rgba(249,115,22,0.35)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'appFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: '#fff',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            width: '30px',
            height: '30px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div style={{ marginBottom: '12px', lineHeight: 1 }}>
          <i className="fa-solid fa-fire" style={{ fontSize: '54px', color: '#F97316' }} />
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#FDBA74',
            marginBottom: '6px'
          }}
        >
          Daily Study Streak
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.3px' }}>
          {streak} Days Active!
        </h2>

        <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: '24px' }}>
          Consistency is the #1 secret to cracking your dream college exam. Keep this momentum roaring!
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '13px 20px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg,#F97316,#EA580C)',
            border: 'none',
            color: '#fff',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(249,115,22,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>Keep Going</span>
          <i className="fa-solid fa-arrow-right" />
        </button>
      </div>
    </div>
  );
};
