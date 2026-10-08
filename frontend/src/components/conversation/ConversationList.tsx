'use client';
import { useState, useCallback } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { conversationsApi, groupsApi } from '@/lib/api';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import ConversationItem from './ConversationItem';
import Avatar from '@/components/ui/Avatar';
import NewGroupModal from '@/components/groups/NewGroupModal';
import AddContactModal from '@/components/contacts/AddContactModal';

interface ConversationListProps {
  onSelectConversation?: () => void;
}

export default function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { user, logout } = useAuth();
  const { conversations, activeConversationId, setActiveConversation, addOrUpdateConversation, loadingConversations } = useChat();
  const [search, setSearch] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await usersApi.list(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleStartChat = useCallback(async (userId: number) => {
    try {
      const conv = await conversationsApi.createDirect(userId);
      addOrUpdateConversation(conv);
      setActiveConversation(conv.id);
      setSearch('');
      setSearchResults([]);
      onSelectConversation?.();
    } catch (e) {
      console.error(e);
    }
  }, [addOrUpdateConversation, setActiveConversation, onSelectConversation]);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const name = c.type === 'direct'
      ? c.members.find((m) => m.user_id !== user?.id)?.user.display_name || ''
      : c.name || '';
    return name.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.content.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sidebar-bg)' }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--sidebar-bg)',
      }}>
        <button
          className="btn-ghost"
          onClick={() => setShowMenu(!showMenu)}
          style={{ padding: 4, position: 'relative' }}
          title="Profile"
        >
          <Avatar user={user} size={36} />
          {showMenu && (
            <div style={{
              position: 'absolute',
              top: '100%', left: 0,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-md)',
              minWidth: 160,
              zIndex: 100,
              overflow: 'hidden',
            }}>
              <button
                className="btn-ghost"
                style={{ width: '100%', padding: '10px 16px', justifyContent: 'flex-start', fontSize: '0.875rem' }}
                onClick={() => { setShowMenu(false); setShowContactModal(true); }}
              >
                Add Contact
              </button>
              <button
                className="btn-ghost"
                style={{ width: '100%', padding: '10px 16px', justifyContent: 'flex-start', fontSize: '0.875rem' }}
                onClick={() => { setShowMenu(false); logout(); }}
              >
                Sign Out
              </button>
            </div>
          )}
        </button>
        <span style={{ fontWeight: 700, fontSize: '1.125rem', flex: 1, color: 'var(--text-primary)' }}>
          Signal
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn-ghost"
            onClick={() => setShowContactModal(true)}
            title="Add Contact"
            style={{ padding: 8 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </button>
          <button
            className="btn-ghost"
            onClick={() => setShowGroupModal(true)}
            title="New Group"
            style={{ padding: 8 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="signal-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: 34, paddingTop: 8, paddingBottom: 8, fontSize: '0.875rem' }}
          />
          {search && (
            <button
              className="btn-ghost"
              onClick={() => { setSearch(''); setSearchResults([]); }}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Search results */}
        {search && searchResults.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px 4px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              People
            </div>
            {searchResults.map((u) => (
              <div
                key={u.id}
                className="conv-item"
                onClick={() => handleStartChat(u.id)}
                role="button"
                tabIndex={0}
              >
                <Avatar user={u} size={44} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{u.display_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '8px 16px 4px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Conversations
            </div>
          </div>
        )}

        {loadingConversations ? (
          <div style={{ padding: 16 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p style={{ fontSize: '0.875rem' }}>
              {search ? 'No results found' : 'No conversations yet'}
            </p>
            {!search && (
              <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Add a contact to start chatting
              </p>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={activeConversationId === conv.id}
              onClick={() => {
                setActiveConversation(conv.id);
                onSelectConversation?.();
              }}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {showGroupModal && (
        <NewGroupModal
          onClose={() => setShowGroupModal(false)}
          onCreated={(conv) => {
            addOrUpdateConversation(conv);
            setActiveConversation(conv.id);
            onSelectConversation?.();
          }}
        />
      )}
      {showContactModal && (
        <AddContactModal onClose={() => setShowContactModal(false)} />
      )}
    </div>
  );
}
