'use client';
import { useState, useCallback, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { conversationsApi, usersApi } from '@/lib/api';
import { User } from '@/types';
import { wsClient } from '@/lib/websocket';
import ConversationItem from './ConversationItem';
import Avatar from '@/components/ui/Avatar';
import NewGroupModal from '@/components/groups/NewGroupModal';
import AddContactModal from '@/components/contacts/AddContactModal';
import ProfileModal from '@/components/ui/ProfileModal';

interface Props { onSelectConversation?: () => void; }

export default function ConversationList({ onSelectConversation }: Props) {
  const { user, logout } = useAuth();
  const { conversations, activeConversationId, setActiveConversation, addOrUpdateConversation, loadingConversations } = useChat();
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Dark mode
  useEffect(() => {
    const saved = localStorage.getItem('signal_theme');
    if (saved === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); setDarkMode(true); }
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('signal_theme', next ? 'dark' : 'light');
  };

  // WS connection status
  useEffect(() => {
    const onConnect = () => setWsStatus('connected');
    const onDisconnect = () => setWsStatus('disconnected');
    wsClient.on('connected', onConnect);
    wsClient.on('disconnected', onDisconnect);
    if (wsClient.isConnected()) setWsStatus('connected');
    return () => { wsClient.off('connected', onConnect); wsClient.off('disconnected', onDisconnect); };
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try { setSearchResults(await usersApi.list(q)); } catch { setSearchResults([]); }
  }, []);

  const handleStartChat = useCallback(async (userId: number) => {
    try {
      const conv = await conversationsApi.createDirect(userId);
      addOrUpdateConversation(conv);
      setActiveConversation(conv.id);
      setSearch(''); setSearchResults([]);
      onSelectConversation?.();
    } catch (e) { console.error(e); }
  }, [addOrUpdateConversation, setActiveConversation, onSelectConversation]);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const name = c.type === 'direct'
      ? c.members.find((m) => m.user_id !== user?.id)?.user.display_name || ''
      : c.name || '';
    return name.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.content.toLowerCase().includes(search.toLowerCase());
  });

  // Modals rendered conditionally via state

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sidebar-bg)' }}>
      {/* WS Status Bar */}
      {wsStatus === 'disconnected' && (
        <div style={{ background: '#F59E0B', color: 'white', fontSize: '0.75rem', textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>
          Reconnecting...
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <button className="btn-ghost" onClick={() => setShowMenu(!showMenu)} style={{ padding: 2, borderRadius: '50%' }}>
            <Avatar user={user} size={38} />
          </button>
          {showMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
              <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 12, boxShadow: 'var(--shadow-md)', minWidth: 180, zIndex: 100, overflow: 'hidden', marginTop: 6 }}>
                <button className="btn-ghost" style={{ width: '100%', padding: '11px 16px', justifyContent: 'flex-start', fontSize: '0.875rem', gap: 10 }}
                  onClick={() => { setShowMenu(false); setShowProfile(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  My Profile
                </button>
                <button className="btn-ghost" style={{ width: '100%', padding: '11px 16px', justifyContent: 'flex-start', fontSize: '0.875rem', gap: 10 }}
                  onClick={() => { setShowMenu(false); setShowContactModal(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                  Add Contact
                </button>
                <button className="btn-ghost" style={{ width: '100%', padding: '11px 16px', justifyContent: 'flex-start', fontSize: '0.875rem', gap: 10 }}
                  onClick={toggleDark}>
                  {darkMode
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                  }
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }} />
                <button className="btn-ghost" style={{ width: '100%', padding: '11px 16px', justifyContent: 'flex-start', fontSize: '0.875rem', color: '#EF4444', gap: 10 }}
                  onClick={() => { setShowMenu(false); logout(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>Signal</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: wsStatus === 'connected' ? 'var(--status-online)' : '#9CA3AF' }} />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
              {wsStatus === 'connected' ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        <button className="btn-ghost" onClick={() => setShowGroupModal(true)} title="New Group" style={{ padding: 8 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </button>
        <button className="btn-ghost" onClick={() => setShowContactModal(true)} title="New Chat" style={{ padding: 8 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            <line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="signal-input" placeholder="Search or start new chat" value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: '0.875rem', borderRadius: 24 }} />
          {search && (
            <button className="btn-ghost" onClick={() => { setSearch(''); setSearchResults([]); }}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Search: user results */}
        {search && searchResults.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px 4px', fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              People
            </div>
            {searchResults.map((u) => (
              <div key={u.id} className="conv-item" onClick={() => handleStartChat(u.id)} role="button" tabIndex={0}>
                <div style={{ position: 'relative' }}>
                  <Avatar user={u} size={46} />
                  {u.is_online && <span className="online-dot" />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{u.display_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    @{u.username}{u.about ? ` · ${u.about}` : ''}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length > 0 && (
              <div style={{ padding: '8px 16px 4px', fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Chats
              </div>
            )}
          </div>
        )}

        {search && searchResults.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            No results for &ldquo;{search}&rdquo;
          </div>
        )}

        {/* Skeleton */}
        {loadingConversations && !search ? (
          <div style={{ padding: '8px 0' }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: `${45 + Math.random() * 30}%`, marginBottom: 7 }} />
                  <div className="skeleton" style={{ height: 11, width: `${55 + Math.random() * 30}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && !search ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" style={{ margin: '0 auto 16px', opacity: 0.25 }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p style={{ fontWeight: 600, marginBottom: 6, fontSize: '1rem' }}>No conversations</p>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>Click the <strong>new chat</strong> button to start a conversation</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={activeConversationId === conv.id}
              onClick={() => { setActiveConversation(conv.id); onSelectConversation?.(); }}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {showGroupModal && (
        <NewGroupModal onClose={() => setShowGroupModal(false)}
          onCreated={(conv: import('@/types').Conversation) => {
            addOrUpdateConversation(conv);
            setActiveConversation(conv.id);
            onSelectConversation?.();
          }} />
      )}
      {showContactModal && <AddContactModal onClose={() => setShowContactModal(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
