'use client';
import { Message } from '@/types';

export default function MessageStatus({ status, size = 16 }: { status: Message['status']; size?: number }) {
  if (status === 'sending') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block" style={{ animation: 'spin 1s linear infinite' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <circle cx="12" cy="12" r="9" stroke="var(--status-sent)" strokeWidth="2" strokeDasharray="42" strokeDashoffset="14" />
      </svg>
    );
  }
  if (status === 'sent') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M5 13l4 4L19 7" stroke="var(--status-sent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M2 13l4 4L16 7" stroke="var(--status-delivered)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13l4 4L22 7" stroke="var(--status-delivered)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'read') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M2 13l4 4L16 7" stroke="var(--status-read)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13l4 4L22 7" stroke="var(--status-read)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}
