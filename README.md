# Signal Clone — Secure Messaging Platform

> **SDE Fullstack Assignment** — A production-quality Signal Messenger clone built with Next.js 15 + FastAPI + WebSockets + SQLite.

---

## 🔗 Quick Start

```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000

# Frontend (port 3000) — separate terminal
cd frontend && npm install && npm run dev
```

**Demo Login:** Any of `alice`, `bob`, `charlie`, `diana`, `emma` · OTP: `123456`

---

## ✅ Feature Checklist

### Authentication
- [x] Username-based sign up / sign in
- [x] Mock OTP (123456) → JWT token
- [x] JWT stored in localStorage, auto-validated on load
- [x] `PUT /api/users/me` — edit display name, phone, about

### Messaging
- [x] Real-time WebSocket messaging (1:1 and group)
- [x] HTTP REST fallback when WebSocket disconnects
- [x] Optimistic UI — instant message render before server ack
- [x] Message persistence (SQLite)
- [x] Message delivery status: ⏳ → ✓ → ✓✓ → 🔵✓✓
- [x] Mark as read when conversation is opened
- [x] Date dividers (Today / Yesterday / date)
- [x] Auto-scroll to latest message
- [x] Auto-growing textarea input (Shift+Enter for newline)

### Conversations
- [x] Direct messages (1:1)
- [x] Group chats with admin + member roles
- [x] Unread message count badge
- [x] Last message preview in sidebar
- [x] Conversation sorting by latest activity
- [x] Search conversations by name or last message

### Groups
- [x] Create group (admin sets name, picks members)
- [x] Colored sender names (each member has unique color)
- [x] Sender avatar shown for last message in group
- [x] Admin can add / remove members
- [x] Non-admin members can **leave** group
- [x] Group info panel (member list + roles)

### Contacts
- [x] Add contact by username
- [x] Search users globally
- [x] Start direct chat from search results

### UI/UX
- [x] Signal-like color scheme (green outgoing, white incoming)
- [x] Dark mode toggle (persisted in localStorage)
- [x] Typing indicators with animated dots
- [x] Online presence indicator (green dot)
- [x] Last seen timestamp
- [x] Message search within conversation (client-side + server-side `?search=`)
- [x] Highlighted search results in chat
- [x] Toast notifications for new messages in non-active conversations
- [x] WS connection status indicator ("● Connected" / "Reconnecting...")
- [x] Skeleton loading states
- [x] Responsive design (mobile-first, back button navigation)
- [x] Profile settings modal (edit display name, about, phone)
- [x] Beautiful welcome screen with feature pills
- [x] Empty state illustrations

### Real-time Events (WebSocket)
- [x] `message.new` — new message broadcast to all conversation members
- [x] `message.sent` — sender confirmation with message ID
- [x] `message.delivered` — delivery receipt
- [x] `message.read` — read receipt (blue ticks)
- [x] `typing.start` / `typing.stop` — typing indicator
- [x] `presence.update` — online/offline status
- [x] Auto-reconnect with exponential backoff (2s → 30s max)

### Backend APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Send OTP |
| `/api/auth/verify-otp` | POST | Verify → JWT |
| `/api/auth/me` | GET | Current user |
| `/api/users` | GET | Search users |
| `/api/users/{id}` | GET | Get user by ID |
| `/api/users/me` | PUT | Update profile |
| `/api/contacts` | GET/POST | List/add contacts |
| `/api/contacts/{id}` | DELETE | Remove contact |
| `/api/conversations` | GET/POST | List/create conversations |
| `/api/conversations/{id}` | GET | Get conversation |
| `/api/conversations/{id}/messages` | GET | Messages (paginated, searchable) |
| `/api/conversations/{id}/messages` | POST | Send message |
| `/api/conversations/{id}/read` | PUT | Mark as read |
| `/api/groups` | POST | Create group |
| `/api/groups/{id}` | GET | Get group details |
| `/api/groups/{id}/members` | POST | Add member (admin) |
| `/api/groups/{id}/members/{uid}` | DELETE | Remove/Leave group |
| `/api/health` | GET | Health check |
| `/ws` | WS | WebSocket connection |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 App Router — Port 3000)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ AuthContext  │  │ ChatContext  │  │ WebSocket    │  │
│  │ (JWT + user) │  │(convs+msgs)  │  │ Singleton    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│          │                │                  │           │
│  ┌──────────────────────────────────────────────────┐   │
│  │    UI Components: ConversationList | ChatView     │   │
│  │    ProfileModal | GroupInfoPanel | Modals | Toast │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP + WebSocket
┌─────────────────────▼───────────────────────────────────┐
│  Backend (FastAPI — Port 8000)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Auth Router  │  │ Messages     │  │ Groups       │  │
│  │ (JWT/OTP)    │  │ Router       │  │ Router       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ConnectionManager (WebSocket singleton)         │   │
│  │  - Per-user connection tracking                  │   │
│  │  - Fan-out to conversation members               │   │
│  │  - Presence updates on connect/disconnect        │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  SQLite (via SQLAlchemy ORM)                     │   │
│  │  Users · Conversations · Members · Messages      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 15 (App Router) |
| Styling | Vanilla CSS (custom design system) |
| State Management | React Context + useReducer patterns |
| Real-time | WebSocket (browser native API) |
| Backend Framework | FastAPI |
| Database | SQLite + SQLAlchemy ORM |
| Auth | JWT (python-jose) + Mock OTP |
| Python | 3.11+ |

---

## 💡 Key Design Decisions (Interview Talking Points)

### 1. WebSocket Architecture
Single persistent connection per user, managed by a **singleton `WebSocketClient`** on the frontend with exponential backoff reconnect. On the backend, `ConnectionManager` maps `user_id → WebSocket` and fans out messages to all conversation members.

**Why not socket.io?** Browser WebSocket API is sufficient, no need for polling fallbacks or extra overhead.

### 2. Optimistic UI
Messages are rendered immediately with a "sending" status (⏳ spinner), then reconciled with the server response using `temp_id` matching. This makes the UI feel instant even under network latency.

### 3. JWT + Query-param Auth for WS
Standard `Authorization` headers aren't supported by the browser WebSocket API. We pass the token as a query parameter: `/ws?token=...`. This is validated server-side on connection. Mitigation: short-lived tokens reduce exposure window.

### 4. State Synchronization
ChatContext handles all conversation state. `activeConvRef` (useRef) is used instead of state in the WS event handler to avoid stale closure issues — a subtle but important React pattern.

### 5. Dark Mode & Theming
All colors are CSS custom properties (`--bg-primary`, `--signal-blue`, etc.). Dark mode is a single attribute toggle (`data-theme="dark"`) persisted to localStorage. Zero JavaScript logic needed for color switching.

---

## 📁 Project Structure

```
scalar project/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (auth, users, convs, messages, groups, ws)
│   │   ├── core/         # Config, deps (JWT validation)
│   │   ├── db/           # Database init + seed data
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── websocket/    # ConnectionManager
│   └── requirements.txt
│
└── frontend/
    ├── app/              # Next.js App Router pages
    ├── components/
    │   ├── chat/         # ChatView (messages, search, typing)
    │   ├── contacts/     # AddContactModal
    │   ├── conversation/ # ConversationList, ConversationItem
    │   ├── groups/       # NewGroupModal
    │   └── ui/           # Avatar, MessageStatus, ProfileModal, Toast
    ├── contexts/         # AuthContext, ChatContext
    ├── lib/              # api.ts, websocket.ts
    └── types/            # TypeScript interfaces
```

---

## 🔐 Security Notes

- All routes except `/api/auth/*` require a valid JWT (Bearer token)
- Conversation access is verified server-side for every request
- Group operations validate admin role server-side
- OTP is mocked (hardcoded `123456`) — production would use SMS/Twilio
- Passwords: No password system (username + OTP only, as per Signal's design)

---

## 🚀 Deployment Notes

For production deployment:
- Replace SQLite with PostgreSQL
- Use environment variables for `SECRET_KEY`, `DATABASE_URL`
- Add Redis for WebSocket state if horizontal scaling needed
- Replace mock OTP with Twilio/SMS service
- Add HTTPS/WSS (required for browser WS in production)
- Frontend: `npm run build && npm start` or deploy to Vercel

```env
# backend/.env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://...
CORS_ORIGINS=["https://yourapp.com"]

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_WS_URL=wss://api.yourapp.com
```
