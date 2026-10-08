'use client';
import { Conversation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/ui/Avatar';

interface Props { conversation: Conversation; active: boolean; onClick: () => void; }

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate())
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationItem({ conversation, active, onClick }: Props) {
  const { user } = useAuth();
  const isGroup = conversation.type === 'group';
  const otherMember = !isGroup ? conversation.members.find((m) => m.user_id !== user?.id) : null;
  const otherUser = otherMember?.user || null;
  const displayName = isGroup ? conversation.name : otherUser?.display_name || 'Unknown';
  const isOnline = otherUser?.is_online || false;
  const lastMsg = conversation.last_message;
  const timestamp = lastMsg?.created_at || conversation.updated_at;
  const isMyLast = lastMsg?.sender_id === user?.id;

  let preview = '';
  if (lastMsg) {
    if (isGroup && !isMyLast) {
      const senderName = conversation.members.find((m) => m.user_id === lastMsg.sender_id)?.user?.display_name?.split(' ')[0] || '';
      preview = senderName ? `${senderName}: ${lastMsg.content}` : lastMsg.content;
    } else {
      preview = isMyLast ? `You: ${lastMsg.content}` : lastMsg.content;
    }
  }

  return (
    <div
      className={`conv-item ${active ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {isGroup ? (
          <div className="avatar" style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1.2rem' }}>
            {(conversation.name || 'G').charAt(0).toUpperCase()}
          </div>
        ) : (
          <Avatar user={otherUser} size={48} />
        )}
        {isOnline && <span className="online-dot" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          {timestamp && (
            <span style={{ fontSize: '0.75rem', color: conversation.unread_count > 0 ? 'var(--signal-blue)' : 'var(--text-tertiary)', flexShrink: 0, fontWeight: conversation.unread_count > 0 ? 600 : 400 }}>
              {formatTime(timestamp)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {preview || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No messages yet</span>}
          </span>
          {conversation.unread_count > 0 && (
            <span className="unread-badge">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>
          )}
        </div>
      </div>
    </div>
  );
}
