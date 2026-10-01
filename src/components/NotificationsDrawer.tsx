import React, { useEffect, useState } from 'react';
import { db, collection, query, limit, orderBy, onSnapshot } from '../services/firebase';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  createdAt?: any;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const unsub = onSnapshot(
        q,
        snap => {
          const list: NotificationItem[] = snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any)
          }));
          setNotifs(list);
        },
        err => {
          console.warn('[Notifications] Firestore warning:', err);
        }
      );
      return () => unsub();
    } catch (e) {}
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 99990,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease'
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 'min(340px, 90vw)',
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 99999,
          transform: isOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.25)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 18px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg,rgba(91,91,246,0.06),rgba(124,58,237,0.03))'
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-bell" style={{ color: 'var(--accent)' }} />
            <span>Updates & Alerts</span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text3)' }}>
              <i className="fa-regular fa-bell" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '10px' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>All caught up!</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>New alerts and mock test releases appear here.</div>
            </div>
          ) : (
            notifs.map(n => (
              <div
                key={n.id}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '10px'
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>
                  {n.body}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
