'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Conversation, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { wsClient } from '@/lib/websocket';
import { usersApi, groupsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import MessageStatus from '@/components/ui/MessageStatus';

interface ChatViewProps {
  conversation: Conversation;
  onBack?: () => void;
}

function formatMsgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function shouldShowDivider(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return true;
  const p = new Date(prev.created_at);
  const c = new Date(curr.created_at);
  return p.toDateString() !== c.toDateString();
}

export default function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, typing, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const convMessages = messages[conversation.id] || [];
  const typingUsers = Object.values(typing[conversation.id] || {});
  const isGroup = conversation.type === 'group';

  const otherUser = !isGroup
    ? conversation.members.find((m) => m.user_id !== user?.id)?.user
    : null;

  const displayName = isGroup ? conversation.name : otherUser?.display_name;
  const isOnline = otherUser?.is_online || false;

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(false);
    await sendMessage(conversation.id, content);
    // Stop typing
    if (isTyping.current) {
      wsClient.send({ type: 'typing.stop', conversationId: conversation.id, data: {} });
      isTyping.current = false;
    }
  }, [input, sending, sendMessage, conversation.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Typing indicator
    if (!isTyping.current) {
      wsClient.send({ type: 'typing.start', conversationId: conversation.id, data: {} });
      isTyping.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      wsClient.send({ type: 'typing.stop', conversationId: conversation.id, data: {} });
      isTyping.current = false;
    }, 2000);
  }, [conversation.id]);

  // Read receipt on view
  useEffect(() => {
    const unreadIds = convMessages
      .filter((m) => m.sender_id !== user?.id && m.status !== 'read')
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      wsClient.send({
        type: 'message.read',
        conversationId: conversation.id,
        data: { messageIds: unreadIds },
      });
    }
  }, [convMessages, conversation.id, user?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10,
      }}>
        {onBack && (
          <button className="btn-ghost" onClick={onBack} style={{ padding: 8, marginLeft: -8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div style={{ position: 'relative', cursor: isGroup ? 'pointer' : 'default' }}
          onClick={() => isGroup && setShowGroupInfo(true)}>
          {isGroup ? (
            <div className="avatar" style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1rem',
            }}>
              {(conversation.name || 'G').charAt(0).toUpperCase()}
            </div>
          ) : (
            <>
              <Avatar user={otherUser} size={40} />
              {isOnline && <span className="online-dot" />}
            </>
          )}
        </div>

        <div style={{ flex: 1, cursor: isGroup ? 'pointer' : 'default' }}
          onClick={() => isGroup && setShowGroupInfo(true)}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {isGroup
              ? `${conversation.members.length} members`
              : isOnline
              ? 'Online'
              : otherUser?.last_seen
              ? `Last seen ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Offline'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-ghost" title="Voice call (coming soon)" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.11 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z" />
            </svg>
          </button>
          <button className="btn-ghost" title="Video call (coming soon)" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
          {isGroup && (
            <button className="btn-ghost" onClick={() => setShowGroupInfo(true)} title="Group info">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {convMessages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, color: 'var(--text-tertiary)',
          }}>
            <div style={{
              background: 'rgba(58,118,240,0.08)',
              borderRadius: 12, padding: '10px 16px',
              fontSize: '0.875rem', textAlign: 'center', maxWidth: 280,
            }}>
              Messages are end-to-end encrypted (simulated). No one outside of this conversation can read them.
            </div>
          </div>
        ) : (
          convMessages.map((msg, idx) => {
            const prev = convMessages[idx - 1];
            const isMe = msg.sender_id === user?.id;
            const showDivider = shouldShowDivider(prev, msg);
            const showSenderName = isGroup && !isMe && (idx === 0 || prev?.sender_id !== msg.sender_id);
            const senderMember = isGroup ? conversation.members.find((m) => m.user_id === msg.sender_id) : null;

            return (
              <div key={msg.id}>
                {showDivider && (
                  <div style={{
                    textAlign: 'center', margin: '12px 0',
                    fontSize: '0.75rem', color: 'var(--text-tertiary)',
                  }}>
                    <span style={{
                      background: 'rgba(150,150,150,0.15)',
                      padding: '4px 12px', borderRadius: 12,
                    }}>
                      {formatDateDivider(msg.created_at)}
                    </span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  marginBottom: 2,
                  alignItems: 'flex-end',
                  gap: 6,
                }}>
                  {/* Group sender avatar */}
                  {isGroup && !isMe && (
                    <div style={{ width: 28, flexShrink: 0 }}>
                      {(idx === convMessages.length - 1 || convMessages[idx + 1]?.sender_id !== msg.sender_id) && (
                        <Avatar user={senderMember?.user} size={28} />
                      )}
                    </div>
                  )}

                  <div style={{ maxWidth: '65%' }}>
                    {showSenderName && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--signal-blue)',
                        fontWeight: 600,
                        marginBottom: 2,
                        paddingLeft: 4,
                      }}>
                        {senderMember?.user?.display_name || 'Unknown'}
                      </div>
                    )}
                    <div className={`bubble ${isMe ? 'bubble-out' : 'bubble-in'}`}>
                      {msg.content}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 4,
                        marginTop: 2,
                      }}>
                        <span style={{ fontSize: '0.6875rem', color: isMe ? 'rgba(0,0,0,0.45)' : 'var(--text-tertiary)' }}>
                          {formatMsgTime(msg.created_at)}
                        </span>
                        {isMe && <MessageStatus status={msg.status} size={14} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
            {isGroup && <div style={{ width: 28 }} />}
            <div className="bubble bubble-in" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
      }}>
        <textarea
          ref={inputRef}
          className="signal-input"
          placeholder="Message"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{
            resize: 'none',
            maxHeight: 120,
            lineHeight: 1.5,
            paddingTop: 10,
            paddingBottom: 10,
            overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden',
          }}
        />
        <button
          className="btn-primary"
          onClick={handleSend}
          disabled={!input.trim()}
          style={{ padding: '10px', borderRadius: '50%', width: 44, height: 44, flexShrink: 0 }}
          title="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>

      {/* Group Info Modal */}
      {showGroupInfo && (
        <GroupInfoPanel
          conversation={conversation}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
    </div>
  );
}

// ─── Group Info Panel ───────────────────────────────────────────────────────

function GroupInfoPanel({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const [toast, setToast] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [adding, setAdding] = useState(false);

  const isAdmin = conversation.members.find((m) => m.user_id === user?.id)?.role === 'admin';

  const handleRemoveMember = async (userId: number) => {
    try {
      await groupsApi.removeMember(conversation.id, userId);
      setToast('Member removed');
      refreshConversations();
    } catch (e: unknown) {
      setToast((e as Error).message || 'Failed');
    }
  };

  const handleAddMember = async () => {
    if (!addUsername.trim()) return;
    setAdding(true);
    try {
      const users = await usersApi.list(addUsername);
      const found = users.find((u: User) => u.username === addUsername.trim());
      if (!found) { setToast('User not found'); return; }
      await groupsApi.addMember(conversation.id, found.id);
      setToast('Member added');
      setAddUsername('');
      setShowAddMember(false);
      refreshConversations();
    } catch (e: unknown) {
      setToast((e as Error).message || 'Failed');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="avatar" style={{
            width: 72, height: 72, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1.75rem',
          }}>
            {(conversation.name || 'G').charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>{conversation.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            {conversation.members.length} members
          </p>
        </div>

        {/* Members */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Members
          </div>
          {conversation.members.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: '1px solid var(--border-primary)',
            }}>
              <Avatar user={m.user} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {m.user.display_name}
                  {m.user_id === user?.id && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8125rem' }}> (You)</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{m.user.username}</div>
              </div>
              {m.role === 'admin' && (
                <span style={{
                  background: 'var(--signal-blue-light)', color: 'var(--signal-blue)',
                  fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                }}>
                  Admin
                </span>
              )}
              {isAdmin && m.user_id !== user?.id && (
                <button
                  className="btn-ghost"
                  onClick={() => handleRemoveMember(m.user_id)}
                  style={{ color: '#EF4444' }}
                  title="Remove"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add member */}
        {isAdmin && (
          <div style={{ marginBottom: 16 }}>
            {showAddMember ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="signal-input"
                  placeholder="Username"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                />
                <button className="btn-primary" onClick={handleAddMember} disabled={adding} style={{ padding: '10px 16px' }}>
                  Add
                </button>
              </div>
            ) : (
              <button
                className="btn-ghost"
                onClick={() => setShowAddMember(true)}
                style={{ color: 'var(--signal-blue)', gap: 8, width: '100%', justifyContent: 'center' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Member
              </button>
            )}
          </div>
        )}

        <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>Close</button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
