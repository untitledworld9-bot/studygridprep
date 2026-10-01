import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { db, addDoc, collection, serverTimestamp } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      await addDoc(collection(db, 'appFeedback'), {
        userId: profile.uid || 'anonymous',
        userName: profile.name || 'Student',
        email: profile.email || '',
        rating,
        feedback,
        createdAt: serverTimestamp()
      });
      confetti({ particleCount: 40, spread: 60 });
    } catch (e) {
      console.warn('Feedback submit error:', e);
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

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
          padding: '30px 24px',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'appFadeIn 0.3s ease',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        {submitted ? (
          <div style={{ padding: '20px 10px' }}>
            <div style={{ marginBottom: '12px' }}>
              <i className="fa-solid fa-heart" style={{ fontSize: '42px', color: '#EF4444' }} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
              Thank You!
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text2)' }}>
              Your feedback fuels continuous improvement for all aspirants!
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
              Rate Study Grid Prep
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '18px' }}>
              Help us craft the ultimate distraction-free study suite!
            </p>

            {/* Stars */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '18px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    color: star <= rating ? '#F59E0B' : 'var(--border)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-star" />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              placeholder="Tell us what you love or what we can add..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                marginBottom: '16px'
              }}
            />

            <button
              onClick={handleSubmit}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg,#5B5BF6,#7C3AED)',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(91,91,246,0.3)'
              }}
            >
              Submit Feedback
            </button>
          </>
        )}
      </div>
    </div>
  );
};
