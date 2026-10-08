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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  // Tab title: show unread count
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    document.title = total > 0 ? `(${total}) Signal Clone` : 'Signal Clone - Secure Messaging';
  }, [conversations]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #3A76F0, #2CA5E0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(58,118,240,0.35)', animation: 'pulse 2s infinite' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Signal</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading secure session...</div>
          <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 8px 24px rgba(58,118,240,0.35); } 50% { box-shadow: 0 8px 32px rgba(58,118,240,0.55); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;
  const showSidebar = !isMobile || mobileView === 'list';
  const showChat = !isMobile || mobileView === 'chat';

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      {showSidebar && (
        <div style={{
          width: isMobile ? '100%' : 'var(--sidebar-width)',
          flexShrink: 0,
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex', flexDirection: 'column', height: '100%',
        }}>
          <ConversationList onSelectConversation={() => setMobileView('chat')} />
        </div>
      )}

      {/* Chat area */}
      {showChat && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeConv ? (
            <ChatView
              conversation={activeConv}
              onBack={() => { setActiveConversation(null); setMobileView('list'); }}
            />
          ) : (
            <WelcomeScreen />
          )}
        </div>
      )}

      <style>{`
        :root { --sidebar-width: 380px; }
        @media (max-width: 960px) { :root { --sidebar-width: 320px; } }
      `}</style>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--chat-bg)', gap: 20, padding: 32,
    }}>
      {/* Icon */}
      <div style={{
        width: 96, height: 96, background: 'linear-gradient(135deg, #3A76F0, #2CA5E0)',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 36px rgba(58,118,240,0.3)',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.875rem', marginBottom: 10, letterSpacing: '-0.02em' }}>
          Signal Clone
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: 24 }}>
          Select a conversation from the sidebar to start messaging, or search for a user to begin a new chat.
        </p>
      </div>

      {/* Feature Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 480 }}>
        {[
          { icon: '🔒', text: 'E2E Encrypted (simulated)' },
          { icon: '⚡', text: 'Real-time WebSocket' },
          { icon: '👥', text: 'Groups & Contacts' },
          { icon: '📱', text: 'Responsive Design' },
          { icon: '🌙', text: 'Dark Mode' },
          { icon: '🔍', text: 'Message Search' },
        ].map(({ icon, text }) => (
          <div key={text} style={{
            background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border-primary)',
            borderRadius: 20, padding: '7px 14px', fontSize: '0.8125rem',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(8px)',
          }}>
            <span>{icon}</span>{text}
          </div>
        ))}
      </div>

      {/* Demo hint */}
      <div style={{
        padding: '12px 20px', background: 'rgba(58,118,240,0.07)', borderRadius: 14,
        border: '1px solid rgba(58,118,240,0.15)', fontSize: '0.875rem', color: 'var(--text-secondary)',
        textAlign: 'center', marginTop: 8,
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Demo users:</strong> alice, bob, charlie, diana, emma
        &nbsp;·&nbsp; OTP: <strong style={{ color: 'var(--signal-blue)' }}>123456</strong>
      </div>
    </div>
  );
}
