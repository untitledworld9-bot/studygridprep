import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export const SubscriptionPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [isActivated, setIsActivated] = useState(profile.isSubscribed || false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const code = coupon.trim().toUpperCase();

    // Standard platform launch coupons or testing codes
    if (code === 'STUDYGRID' || code === 'PRO2026' || code === 'FREEPASS' || code === 'TOPPER') {
      setIsActivated(true);
      localStorage.setItem('isSubscribed', 'true');
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      } catch (e) {}
    } else {
      setErrorMsg('Invalid discount or activation coupon code.');
    }
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Study Grid Prep Pro</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Supercharge your exam preparation</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Pro Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #31104B 100%)',
          borderRadius: '24px',
          padding: '24px 20px',
          color: '#fff',
          boxShadow: '0 10px 30px rgba(91,91,246,0.2)',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <i className="fa-solid fa-crown" style={{ fontSize: '18px', color: '#FBBF24' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#FBBF24' }}>
            {isActivated ? 'PRO MEMBERSHIP ACTIVE' : 'UNLIMITED ACCESS'}
          </span>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.3px' }}>
          Study Grid Prep Pro
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
          Everything you need to crack JEE Main, NEET UG &amp; CUET with top percentiles.
        </p>
      </div>

      {/* Features List */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text)', marginBottom: '14px' }}>
          What's Included in Pro:
        </div>

        {[
          { icon: 'fa-solid fa-check', title: 'Unlimited Full-Length Mock Tests', sub: 'All JEE Main & CUET shift papers with exact NTA CBT layout' },
          { icon: 'fa-solid fa-robot', title: 'Deep AI Diagnostic Analysis', sub: 'Identifies negative mark traps, weak topics & personalized strategy' },
          { icon: 'fa-solid fa-users', title: 'Priority Focus Study Rooms', sub: 'High-speed live study streaming with peers without daily limits' },
          { icon: 'fa-solid fa-file-pdf', title: 'All Revision Notes & Formula Sheets', sub: 'Instant PDF downloads for high-yield formulas' }
        ].map(item => (
          <div key={item.title} style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                flexShrink: 0
              }}
            >
              <i className={item.icon} />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{item.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px', lineHeight: 1.4 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon activation */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '18px',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
          Have an Activation Coupon?
        </div>
        <p style={{ fontSize: '11.5px', color: 'var(--text2)', marginBottom: '12px' }}>
          Enter your school, institute or special invite code (e.g. <code>STUDYGRID</code>).
        </p>

        <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Enter coupon code..."
            value={coupon}
            onChange={e => setCoupon(e.target.value)}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: '13.5px',
              fontWeight: 600,
              textTransform: 'uppercase',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '11px 18px',
              borderRadius: '12px',
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Apply
          </button>
        </form>

        {errorMsg && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}

        {isActivated && (
          <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-check" />
            <span>Pro features are unlocked on your account!</span>
          </div>
        )}
      </div>
    </div>
  );
};
