'use client';
import { useEffect, useRef } from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'error' | 'success';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(onClose, duration);
    return () => clearTimeout(timer.current);
  }, [onClose, duration]);

  const bg =
    type === 'error' ? '#EF4444' : type === 'success' ? '#22C55E' : 'var(--text-primary)';

  return (
    <div className="toast" style={{ background: bg }} onClick={onClose}>
      {message}
    </div>
  );
}
