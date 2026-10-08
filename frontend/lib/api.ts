const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('signal_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const authApi = {
  register: (data: { username: string; display_name: string; phone?: string }) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (username: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username }) }),
  verifyOtp: (username: string, otp: string) =>
    request<{ token: string; user: import('@/types').User }>('/api/auth/verify-otp', {
      method: 'POST', body: JSON.stringify({ username, otp }),
    }),
  me: () => request<import('@/types').User>('/api/auth/me'),
};

export const usersApi = {
  list: (search?: string) =>
    request<import('@/types').User[]>(`/api/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  get: (id: number) => request<import('@/types').User>(`/api/users/${id}`),
  updateMe: (data: Partial<import('@/types').User>) =>
    request<import('@/types').User>('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),
};

export const contactsApi = {
  list: () => request<import('@/types').Contact[]>('/api/contacts'),
  add: (username: string) =>
    request<import('@/types').Contact>('/api/contacts', { method: 'POST', body: JSON.stringify({ username }) }),
  remove: (id: number) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
};

export const conversationsApi = {
  list: () => request<import('@/types').Conversation[]>('/api/conversations'),
  get: (id: string) => request<import('@/types').Conversation>(`/api/conversations/${id}`),
  createDirect: (participantId: number) =>
    request<import('@/types').Conversation>('/api/conversations', {
      method: 'POST', body: JSON.stringify({ type: 'direct', participant_id: participantId }),
    }),
  markRead: (id: string) => request(`/api/conversations/${id}/read`, { method: 'PUT' }),
};

export const messagesApi = {
  list: (conversationId: string, before?: string) =>
    request<import('@/types').Message[]>(
      `/api/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`
    ),
  send: (conversationId: string, content: string, tempId?: string, replyToId?: string) =>
    request<import('@/types').Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST', body: JSON.stringify({ content, temp_id: tempId, reply_to_id: replyToId }),
    }),
  react: (conversationId: string, messageId: string, emoji: string) =>
    request<{ message_id: string; reactions: Record<string, number[]> }>(
      `/api/conversations/${conversationId}/messages/${messageId}/react`,
      { method: 'POST', body: JSON.stringify({ emoji }) }
    ),
};


export const groupsApi = {
  create: (name: string, memberIds: number[]) =>
    request<import('@/types').Conversation>('/api/groups', {
      method: 'POST', body: JSON.stringify({ name, member_ids: memberIds }),
    }),
  get: (id: string) => request<import('@/types').Conversation>(`/api/groups/${id}`),
  addMember: (groupId: string, userId: number) =>
    request(`/api/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeMember: (groupId: string, userId: number) =>
    request(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
};

export const getApiBase = () => API_BASE;
