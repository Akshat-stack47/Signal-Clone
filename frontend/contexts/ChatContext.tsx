'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, WSEvent } from '@/types';
import { conversationsApi, messagesApi } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { useAuth } from './AuthContext';
import { showToast } from '@/components/ui/Toast';


interface TypingState {
  [conversationId: string]: { [userId: number]: string };
}

interface ChatContextValue {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: { [convId: string]: Message[] };
  typing: TypingState;
  loadingConversations: boolean;
  loadingMessages: boolean;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string, replyToId?: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  addOrUpdateConversation: (conv: Conversation) => void;
  updateMessageReaction: (convId: string, msgId: string, reactions: Record<string, number[]>) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ [convId: string]: Message[] }>({});
  const [typing, setTyping] = useState<TypingState>({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const typingTimers = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  const activeConvRef = useRef<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    try {
      const convs = await conversationsApi.list();
      setConversations(convs);
    } catch (e) { console.error(e); }
    finally { setLoadingConversations(false); }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const msgs = await messagesApi.list(conversationId);
      setMessages((prev) => ({ ...prev, [conversationId]: msgs }));
      await conversationsApi.markRead(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
    } catch (e) { console.error(e); }
    finally { setLoadingMessages(false); }
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConvId(id);
    activeConvRef.current = id;
    if (id && !messages[id]) loadMessages(id);
    else if (id) {
      conversationsApi.markRead(id).catch(() => {});
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
    }
  }, [messages, loadMessages]);

  const addOrUpdateConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === conv.id);
      if (exists) return prev.map((c) => (c.id === conv.id ? conv : c));
      return [conv, ...prev];
    });
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string, replyToId?: string) => {
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId, conversation_id: conversationId, sender_id: user.id,
      content, message_type: 'text', status: 'sending',
      created_at: new Date().toISOString(), sender: user, temp_id: tempId,
      reply_to_id: replyToId,
    };
    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] || []), optimistic] }));
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId
        ? { ...c, last_message: optimistic, updated_at: new Date().toISOString() } : c
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );

    if (wsClient.isConnected()) {
      wsClient.send({ type: 'message.send', conversationId, data: { content, tempId, messageType: 'text', replyToId } });
    } else {
      try {
        const sent = await messagesApi.send(conversationId, content, tempId, replyToId);
        setMessages((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).map((m) =>
            m.temp_id === tempId ? { ...sent, sender: user } : m
          ),
        }));
      } catch (e) {
        console.error('Failed to send message:', e);
        // Mark as failed
        setMessages((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).map((m) =>
            m.temp_id === tempId ? { ...m, status: 'sent' as Message['status'] } : m
          ),
        }));
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const updateMessageReaction = (convId: string, msgId: string, reactions: Record<string, number[]>) => {
      setMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) => m.id === msgId ? { ...m, reactions } : m),
      }));
    };
    void updateMessageReaction; // Used via provider value inline function below

    const handleNewMessage = (event: WSEvent) => {
      const convId = event.conversationId!;
      const msg = event.data as unknown as Message;
      setMessages((prev) => {
        const existing = prev[convId] || [];
        const filtered = existing.filter(
          (m) => !(m.status === 'sending' && m.sender_id === user.id && m.content === msg.content)
        );
        if (filtered.find((m) => m.id === msg.id)) return prev;
        return { ...prev, [convId]: [...filtered, msg] };
      });
      // Cross-conversation toast + browser notification
      if (msg.sender_id !== user.id && activeConvRef.current !== convId) {
        const senderName = msg.sender?.display_name || 'Someone';
        const preview = msg.content.length > 45 ? msg.content.slice(0, 45) + '...' : msg.content;
        showToast(`${senderName}: ${preview}`);
        // Native browser notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(`Signal Clone — ${senderName}`, { body: preview, icon: '/favicon.ico', tag: convId });
        }
      }
      setConversations((prev) =>
        prev.map((c) => c.id === convId
          ? { ...c, last_message: msg, updated_at: msg.created_at,
              unread_count: activeConvRef.current === convId ? 0 : c.unread_count + 1 }
          : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
      if (msg.sender_id !== user.id) {
        wsClient.send({ type: 'message.delivered', conversationId: convId, data: { messageIds: [msg.id] } });
      }
    };


    const handleMessageSent = (event: WSEvent) => {
      const convId = event.conversationId!;
      const data = event.data as { id: string; tempId?: string; temp_id?: string; status: string };
      const tId = data.tempId || data.temp_id;
      setMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.temp_id === tId || m.id === tId
            ? { ...m, id: data.id, status: data.status as Message['status'] } : m
        ),
      }));
    };

    const handleDelivered = (event: WSEvent) => {
      const convId = event.conversationId!;
      const data = event.data as { messageId?: string; messageIds?: string[] };
      const ids = data.messageIds || (data.messageId ? [data.messageId] : []);
      setMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          ids.includes(m.id) && m.status === 'sent' ? { ...m, status: 'delivered' } : m
        ),
      }));
    };

    const handleRead = (event: WSEvent) => {
      const convId = event.conversationId!;
      const data = event.data as { messageIds: string[] };
      setMessages((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          data.messageIds.includes(m.id) ? { ...m, status: 'read' } : m
        ),
      }));
    };

    const handleTypingStart = (event: WSEvent) => {
      const convId = event.conversationId!;
      const data = event.data as { userId: number; displayName: string };
      if (data.userId === user.id) return;
      setTyping((prev) => ({ ...prev, [convId]: { ...(prev[convId] || {}), [data.userId]: data.displayName } }));
      const key = `${convId}-${data.userId}`;
      if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => {
        setTyping((prev) => {
          const updated = { ...(prev[convId] || {}) };
          delete updated[data.userId];
          return { ...prev, [convId]: updated };
        });
      }, 4000);
    };

    const handleTypingStop = (event: WSEvent) => {
      const convId = event.conversationId!;
      const data = event.data as { userId: number };
      setTyping((prev) => {
        const updated = { ...(prev[convId] || {}) };
        delete updated[data.userId];
        return { ...prev, [convId]: updated };
      });
    };

    const handlePresence = (event: WSEvent) => {
      const data = event.data as { user_id: number; is_online: boolean };
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members.map((m) =>
            m.user_id === data.user_id ? { ...m, user: { ...m.user, is_online: data.is_online } } : m
          ),
        }))
      );
    };

    wsClient.on('message.new', handleNewMessage);
    wsClient.on('message.sent', handleMessageSent);
    wsClient.on('message.delivered', handleDelivered);
    wsClient.on('message.read', handleRead);
    wsClient.on('typing.start', handleTypingStart);
    wsClient.on('typing.stop', handleTypingStop);
    wsClient.on('presence.update', handlePresence);

    return () => {
      wsClient.off('message.new', handleNewMessage);
      wsClient.off('message.sent', handleMessageSent);
      wsClient.off('message.delivered', handleDelivered);
      wsClient.off('message.read', handleRead);
      wsClient.off('typing.start', handleTypingStart);
      wsClient.off('typing.stop', handleTypingStop);
      wsClient.off('presence.update', handlePresence);
    };
  }, [user]);

  useEffect(() => { if (user) refreshConversations(); }, [user, refreshConversations]);

  return (
    <ChatContext.Provider value={{
      conversations, activeConversationId, messages, typing,
      loadingConversations, loadingMessages,
      setActiveConversation, sendMessage, loadMessages,
      refreshConversations, addOrUpdateConversation,
      updateMessageReaction: (convId: string, msgId: string, reactions: Record<string, number[]>) => {
        setMessages((prev) => ({
          ...prev,
          [convId]: (prev[convId] || []).map((m) => m.id === msgId ? { ...m, reactions } : m),
        }));
      },
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be inside ChatProvider');
  return ctx;
}
