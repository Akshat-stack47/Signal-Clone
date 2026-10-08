export interface User {
  id: number;
  username: string;
  display_name: string;
  phone?: string;
  avatar_url?: string;
  about?: string;
  is_online: boolean;
  last_seen?: string;
}

export interface ConversationMember {
  id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string;
  user: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: number;
  content: string;
  message_type: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  created_at: string;
  sender?: User;
  temp_id?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar_url?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message?: Message;
  unread_count: number;
}

export interface Contact {
  id: number;
  user_id: number;
  contact_user: User;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// WebSocket event types
export type WSEventType =
  | 'message.new'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'typing.start'
  | 'typing.stop'
  | 'presence.update';

export interface WSEvent {
  type: WSEventType;
  conversationId?: string;
  data: Record<string, unknown>;
}
