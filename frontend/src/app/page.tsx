'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import ConversationList from '@/components/conversation/ConversationList';
import ChatView from '@/components/chat/ChatView';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { conversations, activeConversationId, setActiveConversation } = useChat();
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #3A76F0, #2CA5E0)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      {/* ─── Sidebar ─── */}
      <div style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        // On mobile: show only when mobileView === 'list'
      }} className={`sidebar ${mobileView === 'chat' ? 'hide-mobile' : ''}`}>
        <ConversationList
          onSelectConversation={() => setMobileView('chat')}
        />
      </div>

      {/* ─── Chat area ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
        className={`chat-area ${mobileView === 'list' ? 'hide-mobile' : ''}`}>
        {activeConversation ? (
          <ChatView
            conversation={activeConversation}
            onBack={() => { setActiveConversation(null); setMobileView('list'); }}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--chat-bg)',
            gap: 16,
          }}>
            <div style={{
              width: 80, height: 80,
              background: 'rgba(58,118,240,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--signal-blue)" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 8 }}>
                Signal Clone
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: 320, lineHeight: 1.5 }}>
                Select a conversation to start messaging or click the icons above to add a contact or create a group.
              </p>
            </div>
            <div style={{
              padding: '12px 20px',
              background: 'rgba(58,118,240,0.06)',
              borderRadius: 12,
              border: '1px solid rgba(58,118,240,0.12)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              maxWidth: 300,
            }}>
              Messages are end-to-end encrypted (simulated).
              <br />
              <span style={{ color: 'var(--text-tertiary)' }}>OTP: 123456</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .sidebar { width: 100% !important; }
          .hide-mobile { display: none !important; }
        }
        :root {
          --sidebar-width: 360px;
        }
        @media (max-width: 900px) {
          :root { --sidebar-width: 300px; }
        }
      `}</style>
    </div>
  );
}
