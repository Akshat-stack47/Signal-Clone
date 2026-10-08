from pydantic import BaseModel, Field
from datetime import datetime


# ─── Auth Schemas ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = None


class VerifyOTPRequest(BaseModel):
    username: str
    otp: str


class LoginRequest(BaseModel):
    username: str


class AuthResponse(BaseModel):
    token: str
    user: "UserResponse"


# ─── User Schemas ──────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    phone: str | None = None
    avatar_url: str | None = None
    about: str | None = None
    is_online: bool = False
    last_seen: datetime | None = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    about: str | None = None


# ─── Contact Schemas ──────────────────────────────────────────

class AddContactRequest(BaseModel):
    username: str


class ContactResponse(BaseModel):
    id: int
    user_id: int
    contact_user: UserResponse
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Conversation Schemas ─────────────────────────────────────

class CreateConversationRequest(BaseModel):
    type: str = "direct"  # "direct" or "group"
    participant_id: int | None = None  # For direct chats
    name: str | None = None  # For groups
    member_ids: list[int] = []  # For groups


class ConversationResponse(BaseModel):
    id: str
    type: str
    name: str | None = None
    avatar_url: str | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    members: list["ConversationMemberResponse"] = []
    last_message: "MessageResponse | None" = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class ConversationMemberResponse(BaseModel):
    id: int
    user_id: int
    role: str
    joined_at: datetime
    last_read_at: datetime | None = None
    user: UserResponse

    class Config:
        from_attributes = True


# ─── Message Schemas ──────────────────────────────────────────

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: str = "text"
    temp_id: str | None = None  # Client-side temp ID for optimistic UI
    reply_to_id: str | None = None  # ID of message being replied to


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: int
    content: str
    message_type: str
    status: str
    created_at: datetime
    sender: UserResponse | None = None
    temp_id: str | None = None
    reply_to_id: str | None = None
    reactions: dict = {}

    class Config:
        from_attributes = True


class ReactRequest(BaseModel):
    emoji: str = Field(..., max_length=10)


class UpdateMessageStatusRequest(BaseModel):
    message_ids: list[str]
    status: str  # "delivered" or "read"


# ─── Group Schemas ────────────────────────────────────────────

class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    member_ids: list[int] = Field(..., min_length=1)
    avatar_url: str | None = None


class AddGroupMemberRequest(BaseModel):
    user_id: int


class GroupResponse(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    created_by: int
    created_at: datetime
    members: list[ConversationMemberResponse] = []

    class Config:
        from_attributes = True


# ─── WebSocket Schemas ────────────────────────────────────────

class WSMessage(BaseModel):
    type: str
    conversation_id: str | None = None
    data: dict = {}


# Rebuild forward refs
AuthResponse.model_rebuild()
ConversationResponse.model_rebuild()
