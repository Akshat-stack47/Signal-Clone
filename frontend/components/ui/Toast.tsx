'use client';
import { useEffect, useRef, useState } from 'react';

interface ToastMessage { id: string; text: string; type?: 'info' | 'success' | 'error'; }

let toastListeners: ((msg: ToastMessage) => void)[] = [];

export function showToast(text: string, type: 'info' | 'success' | 'error' = 'info') {
  const msg: ToastMessage = { id: Date.now().toString(), text, type };
  toastListeners.forEach((fn) => fn(msg));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const listener = (msg: ToastMessage) => {
      setToasts((prev) => [...prev.slice(-3), msg]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
        timers.current.delete(msg.id);
      }, 3500);
      timers.current.set(msg.id, timer);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, alignItems: 'center' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#EF4444' : t.type === 'success' ? '#22C55E' : 'var(--text-primary)',
          color: 'var(--bg-primary)', padding: '10px 20px', borderRadius: 10,
          fontSize: '0.875rem', fontWeight: 500, boxShadow: 'var(--shadow-md)',
          animation: 'toastIn 0.25s ease', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {t.type === 'success' && '✓ '}{t.type === 'error' && '⚠ '}{t.text}
        </div>
      ))}
    </div>
  );
}
