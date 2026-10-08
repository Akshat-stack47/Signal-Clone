'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { wsClient } from '@/lib/websocket';
import { groupsApi, usersApi, messagesApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import MessageStatus from '@/components/ui/MessageStatus';
import { showToast } from '@/components/ui/Toast';

interface Props { conversation: Conversation; onBack?: () => void; }

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MEMBER_COLORS = ['#E53935', '#8E24AA', '#1E88E5', '#00897B', '#FB8C00', '#D81B60', '#3949AB', '#00ACC1'];

function fmtTime(d: string) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d: string) {
  const date = new Date(d); const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function getMemberColor(userId: number, members: Conversation['members']): string {
  const idx = members.findIndex((m) => m.user_id === userId);
  return MEMBER_COLORS[Math.abs(idx) % MEMBER_COLORS.length];
}

export default function ChatView({ conversation, onBack }: Props) {
  const { user } = useAuth();
  const { messages, typing, sendMessage, updateMessageReaction } = useChat();
  const [input, setInput] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const isTypingRef = useRef(false);

  const convMessages = messages[conversation.id] || [];
  const typingUsers = Object.values(typing[conversation.id] || {});
  const isGroup = conversation.type === 'group';
  const otherUser = !isGroup ? conversation.members.find((m) => m.user_id !== user?.id)?.user : null;
  const displayName = isGroup ? conversation.name : otherUser?.display_name;

  const filteredMessages = searchQuery
    ? convMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : convMessages;

  // Auto-scroll
  useEffect(() => {
    if (!searchMode) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length, typingUsers.length, searchMode]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // Browser notifications permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Read receipts
  useEffect(() => {
    const unreadIds = convMessages.filter((m) => m.sender_id !== user?.id && m.status !== 'read').map((m) => m.id);
    if (unreadIds.length > 0) {
      wsClient.send({ type: 'message.read', conversationId: conversation.id, data: { messageIds: unreadIds } });
    }
  }, [convMessages, conversation.id, user?.id]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    setReplyTo(null);
    if (isTypingRef.current) {
      wsClient.send({ type: 'typing.stop', conversationId: conversation.id, data: {} });
      isTypingRef.current = false;
    }
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(conversation.id, content, replyTo?.id);
  }, [input, sendMessage, conversation.id, replyTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') {
      setSearchMode(false); setSearchQuery('');
      setReplyTo(null); setEmojiPickerMsgId(null);
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isTypingRef.current) {
      wsClient.send({ type: 'typing.start', conversationId: conversation.id, data: {} });
      isTypingRef.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      wsClient.send({ type: 'typing.stop', conversationId: conversation.id, data: {} });
      isTypingRef.current = false;
    }, 2000);
  }, [conversation.id]);

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    setEmojiPickerMsgId(null);
    try {
      const result = await messagesApi.react(conversation.id, msgId, emoji);
      updateMessageReaction(conversation.id, msgId, result.reactions);
    } catch { /* ignore */ }
  }, [conversation.id, updateMessageReaction]);

  const myMember = conversation.members.find((m) => m.user_id === user?.id);
  const isAdmin = myMember?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)' }}
      onClick={() => setEmojiPickerMsgId(null)}>
      {/* Header */}
      <div style={{ padding: '11px 16px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)', zIndex: 10, flexShrink: 0 }}>
        {onBack && (
          <button className="btn-ghost" onClick={onBack} style={{ padding: 8, marginLeft: -8, flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
        )}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: 0 }}
          onClick={() => isGroup && setShowGroupInfo(true)}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {isGroup ? (
              <div className="avatar" style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1rem' }}>
                {(conversation.name || 'G').charAt(0).toUpperCase()}
              </div>
            ) : (
              <><Avatar user={otherUser} size={40} />{otherUser?.is_online && <span className="online-dot" />}</>
            )}
          </div>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isGroup ? `${conversation.members.length} members · tap for info`
                : typingUsers.length > 0 ? '✍️ typing...'
                : otherUser?.is_online ? '🟢 online'
                : otherUser?.last_seen ? `last seen ${fmtTime(otherUser.last_seen)}` : 'offline'}
            </div>
          </div>
        </button>
        <button className="btn-ghost" onClick={() => { setSearchMode(!searchMode); setSearchQuery(''); }} title="Search" style={{ padding: 8 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </button>
        <button className="btn-ghost" title="Voice call (coming soon)" style={{ opacity: 0.35, cursor: 'not-allowed', padding: 8 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a2 2 0 012-2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
        </button>
        {isGroup && (
          <button className="btn-ghost" onClick={() => setShowGroupInfo(true)} title="Group info" style={{ padding: 8 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </button>
        )}
      </div>

      {/* Search bar */}
      {searchMode && (
        <div style={{ padding: '8px 12px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input className="signal-input" placeholder="Search messages..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} autoFocus
              style={{ paddingLeft: 30, fontSize: '0.875rem', paddingTop: 8, paddingBottom: 8 }} />
          </div>
          {searchQuery && <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', alignSelf: 'center', flexShrink: 0 }}>{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}</span>}
          <button className="btn-ghost" onClick={() => { setSearchMode(false); setSearchQuery(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {convMessages.length === 0 && !searchQuery ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: '10px 16px', fontSize: '0.8125rem', textAlign: 'center', maxWidth: 280, color: 'var(--text-secondary)' }}>
              {isGroup ? `You created "${conversation.name}"` : 'Messages are end-to-end encrypted (simulated). Tap 💬 to send your first message.'}
            </div>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const prev = filteredMessages[idx - 1];
            const next = filteredMessages[idx + 1];
            const isMe = msg.sender_id === user?.id;
            const showDivider = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
            const senderMember = isGroup ? conversation.members.find((m) => m.user_id === msg.sender_id) : null;
            const showSenderName = isGroup && !isMe && (!prev || prev.sender_id !== msg.sender_id);
            const isLastInGroup = !next || next.sender_id !== msg.sender_id;
            const memberColor = isGroup ? getMemberColor(msg.sender_id, conversation.members) : '';
            const isHighlighted = searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase());
            const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

            return (
              <div key={msg.id}>
                {showDivider && (
                  <div style={{ textAlign: 'center', margin: '12px 0' }}>
                    <span style={{ background: 'rgba(150,150,150,0.18)', padding: '3px 12px', borderRadius: 12, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {fmtDate(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: hasReactions ? 20 : 2, alignItems: 'flex-end', gap: 6, position: 'relative' }}
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                >
                  {isGroup && !isMe && (
                    <div style={{ width: 28, flexShrink: 0, paddingBottom: 2 }}>
                      {isLastInGroup && <Avatar user={senderMember?.user} size={26} />}
                    </div>
                  )}
                  <div style={{ maxWidth: '65%' }}>
                    {showSenderName && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 3, paddingLeft: 4, color: memberColor }}>
                        {senderMember?.user?.display_name || 'Unknown'}
                      </div>
                    )}

                    {/* Reply-to context */}
                    {msg.reply_to && (
                      <div style={{ background: isMe ? 'rgba(0,0,0,0.1)' : 'var(--bg-tertiary)', borderLeft: '3px solid var(--signal-blue)', borderRadius: '6px 6px 0 0', padding: '4px 10px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: -4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--signal-blue)', fontSize: '0.75rem' }}>
                          {msg.reply_to.sender_id === user?.id ? 'You' : msg.reply_to.sender?.display_name}
                        </span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 250 }}>
                          {msg.reply_to.content}
                        </div>
                      </div>
                    )}

                    <div className={`bubble ${isMe ? 'bubble-out' : 'bubble-in'}`}
                      style={{ background: isHighlighted ? 'rgba(58,118,240,0.25)' : undefined, borderTopLeftRadius: msg.reply_to && !isMe ? 0 : undefined, borderTopRightRadius: msg.reply_to && isMe ? 0 : undefined }}>
                      <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                        {searchQuery ? highlightText(msg.content, searchQuery) : msg.content}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 }}>
                        <span style={{ fontSize: '0.6875rem', color: isMe ? 'rgba(0,0,0,0.45)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                          {fmtTime(msg.created_at)}
                        </span>
                        {isMe && <MessageStatus status={msg.status} size={14} />}
                      </div>
                    </div>

                    {/* Reactions display */}
                    {hasReactions && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        {Object.entries(msg.reactions!).map(([emoji, users]) => {
                          const iMine = users.includes(user?.id || 0);
                          return (
                            <button key={emoji} onClick={() => handleReact(msg.id, emoji)}
                              style={{ background: iMine ? 'rgba(58,118,240,0.15)' : 'var(--bg-secondary)', border: iMine ? '1px solid rgba(58,118,240,0.4)' : '1px solid var(--border-primary)', borderRadius: 20, padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {emoji} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: iMine ? 'var(--signal-blue)' : 'var(--text-secondary)' }}>{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  {hoveredMsgId === msg.id && !searchMode && (
                    <div style={{ position: 'absolute', top: 0, [isMe ? 'left' : 'right']: isGroup && !isMe ? 38 : 0, display: 'flex', gap: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '3px 6px', boxShadow: 'var(--shadow-md)', zIndex: 5, transform: 'translateY(-100%)' }}
                      onClick={(e) => e.stopPropagation()}>
                      {/* Reply */}
                      <button title="Reply" onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }} className="btn-ghost" style={{ padding: '4px 6px', fontSize: '0.875rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 00-4-4H4" /></svg>
                      </button>
                      {/* React */}
                      <button title="React" onClick={(e) => { e.stopPropagation(); setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id); }} className="btn-ghost" style={{ padding: '4px 6px', fontSize: '0.875rem' }}>
                        😊
                      </button>
                      {/* Copy */}
                      <button title="Copy" onClick={() => { navigator.clipboard.writeText(msg.content); showToast('Copied!', 'success'); }} className="btn-ghost" style={{ padding: '4px 6px', fontSize: '0.875rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      </button>
                    </div>
                  )}

                  {/* Emoji picker */}
                  {emojiPickerMsgId === msg.id && (
                    <div style={{ position: 'absolute', top: 0, [isMe ? 'left' : 'right']: 0, transform: 'translateY(calc(-100% - 8px))', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '8px 10px', boxShadow: 'var(--shadow-lg)', display: 'flex', gap: 6, zIndex: 20 }}
                      onClick={(e) => e.stopPropagation()}>
                      {QUICK_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => handleReact(msg.id, emoji)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.375rem', borderRadius: 8, padding: '2px 4px', transition: 'transform 0.1s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing */}
        {typingUsers.length > 0 && !searchMode && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
            {isGroup && <div style={{ width: 28 }} />}
            <div className="bubble bubble-in" style={{ padding: '8px 14px', maxWidth: 120 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5 }}>{typingUsers.slice(0, 2).join(', ')}</div>
              <div style={{ display: 'flex', gap: 4 }}><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ padding: '8px 16px', background: 'var(--sidebar-bg)', borderTop: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ borderLeft: '3px solid var(--signal-blue)', paddingLeft: 10, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--signal-blue)' }}>
              Replying to {replyTo.sender_id === user?.id ? 'yourself' : replyTo.sender?.display_name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.content}
            </div>
          </div>
          <button className="btn-ghost" onClick={() => setReplyTo(null)} style={{ padding: 4, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 14px', background: 'var(--sidebar-bg)', borderTop: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <textarea ref={textareaRef} className="signal-input"
          placeholder={`Message${isGroup ? ` ${conversation.name}` : ''}${replyTo ? ' (replying...)' : ''}`}
          value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
          rows={1} style={{ resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10, overflowY: 'hidden', flex: 1 }} />
        <button className="btn-primary" onClick={handleSend} disabled={!input.trim()}
          style={{ padding: 0, borderRadius: '50%', width: 42, height: 42, flexShrink: 0 }} title="Send (Enter)">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
        </button>
      </div>

      {/* Group Info */}
      {showGroupInfo && (
        <GroupInfoPanel conversation={conversation} isAdmin={isAdmin} currentUserId={user?.id || 0} onClose={() => setShowGroupInfo(false)} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return <>{parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <mark key={i} style={{ background: 'rgba(58,118,240,0.35)', borderRadius: 2, padding: '0 1px' }}>{part}</mark> : part)}</>;
}

// ─── Group Info Panel ──────────────────────────────────────────────────────
interface GroupInfoProps { conversation: Conversation; isAdmin: boolean; currentUserId: number; onClose: () => void; }
const MEMBER_COLORS_MAP = ['#E53935', '#8E24AA', '#1E88E5', '#00897B', '#FB8C00', '#D81B60', '#3949AB', '#00ACC1'];

function GroupInfoPanel({ conversation, isAdmin, currentUserId, onClose }: GroupInfoProps) {
  const { refreshConversations, setActiveConversation } = useChat();
  const [addUsername, setAddUsername] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleRemove = async (userId: number) => {
    try { await groupsApi.removeMember(conversation.id, userId); showToast('Member removed', 'success'); await refreshConversations(); }
    catch (e: unknown) { showToast((e as Error).message || 'Failed', 'error'); }
  };

  const handleAdd = async () => {
    if (!addUsername.trim()) return;
    setAdding(true);
    try {
      const users = await usersApi.list(addUsername);
      const found = users.find((u) => u.username === addUsername.trim());
      if (!found) { showToast('User not found', 'error'); return; }
      await groupsApi.addMember(conversation.id, found.id);
      showToast(`${found.display_name} added`, 'success');
      setAddUsername(''); setShowAdd(false);
      await refreshConversations();
    } catch (e: unknown) { showToast((e as Error).message || 'Failed', 'error'); }
    finally { setAdding(false); }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return;
    setLeaving(true);
    try { await groupsApi.removeMember(conversation.id, currentUserId); showToast('Left group', 'info'); setActiveConversation(null); await refreshConversations(); onClose(); }
    catch (e: unknown) { showToast((e as Error).message || 'Failed', 'error'); }
    finally { setLeaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="avatar" style={{ width: 72, height: 72, margin: '0 auto 12px', background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1.75rem' }}>
            {(conversation.name || 'G').charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>{conversation.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>{conversation.members.length} member{conversation.members.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Members</div>
          {conversation.members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
              <Avatar user={m.user} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: MEMBER_COLORS_MAP[i % MEMBER_COLORS_MAP.length], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.user.display_name}{m.user_id === currentUserId && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8125rem' }}> (You)</span>}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{m.user.username}</div>
              </div>
              {m.role === 'admin' && <span style={{ background: 'var(--signal-blue-light)', color: 'var(--signal-blue)', fontSize: '0.6875rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>Admin</span>}
              {isAdmin && m.user_id !== currentUserId && (
                <button className="btn-ghost" onClick={() => handleRemove(m.user_id)} style={{ color: '#EF4444', padding: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (showAdd ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="signal-input" placeholder="Username to add" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} autoFocus />
            <button className="btn-primary" onClick={handleAdd} disabled={adding} style={{ padding: '10px 14px', flexShrink: 0 }}>{adding ? '...' : 'Add'}</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setShowAdd(true)} style={{ color: 'var(--signal-blue)', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 12, padding: '10px 0' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Add Member
          </button>
        ))}
        {!isAdmin && <button className="btn-ghost" onClick={handleLeave} disabled={leaving} style={{ color: '#EF4444', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 12, padding: '10px 0' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          {leaving ? 'Leaving...' : 'Leave Group'}
        </button>}
        <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
      </div>
    </div>
  );
}
