import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.db.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Message
from app.core.deps import get_current_user
from app.schemas import (
    CreateConversationRequest,
    ConversationResponse,
    ConversationMemberResponse,
    MessageResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def build_conversation_response(conv: Conversation, current_user_id: int, db: Session) -> dict:
    """Build a conversation response dict with last message and unread count."""
    # Get last message
    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(desc(Message.created_at))
        .first()
    )

    # Get unread count
    member = next((m for m in conv.members if m.user_id == current_user_id), None)
    unread_count = 0
    if member and member.last_read_at:
        unread_count = (
            db.query(func.count(Message.id))
            .filter(
                Message.conversation_id == conv.id,
                Message.created_at > member.last_read_at,
                Message.sender_id != current_user_id,
            )
            .scalar()
        )
    elif member:
        unread_count = (
            db.query(func.count(Message.id))
            .filter(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
            )
            .scalar()
        )

    # Build member responses
    members_resp = []
    for m in conv.members:
        members_resp.append(
            ConversationMemberResponse(
                id=m.id,
                user_id=m.user_id,
                role=m.role,
                joined_at=m.joined_at,
                last_read_at=m.last_read_at,
                user=UserResponse.model_validate(m.user),
            )
        )

    last_message = None
    if last_msg:
        last_message = MessageResponse(
            id=last_msg.id,
            conversation_id=last_msg.conversation_id,
            sender_id=last_msg.sender_id,
            content=last_msg.content,
            message_type=last_msg.message_type,
            status=last_msg.status,
            created_at=last_msg.created_at,
            sender=UserResponse.model_validate(last_msg.sender) if last_msg.sender else None,
        )

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        avatar_url=conv.avatar_url,
        created_by=conv.created_by,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        members=members_resp,
        last_message=last_message,
        unread_count=unread_count,
    )


@router.get("", response_model=list[ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .join(ConversationMember)
        .filter(ConversationMember.user_id == current_user.id)
        .order_by(desc(Conversation.updated_at))
        .all()
    )
    result = []
    for conv in conversations:
        result.append(build_conversation_response(conv, current_user.id, db))
    return result


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: CreateConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.type == "direct":
        if not req.participant_id:
            raise HTTPException(status_code=400, detail="participant_id required for direct chat")

        # Check if direct conversation already exists
        existing = (
            db.query(Conversation)
            .join(ConversationMember, Conversation.id == ConversationMember.conversation_id)
            .filter(
                Conversation.type == "direct",
                ConversationMember.user_id == current_user.id,
            )
            .all()
        )
        for conv in existing:
            member_ids = {m.user_id for m in conv.members}
            if req.participant_id in member_ids and current_user.id in member_ids:
                return build_conversation_response(conv, current_user.id, db)

        # Create new direct conversation
        conv = Conversation(
            id=str(uuid.uuid4()),
            type="direct",
            created_by=current_user.id,
        )
        db.add(conv)
        db.flush()

        db.add(ConversationMember(conversation_id=conv.id, user_id=current_user.id, role="member"))
        db.add(ConversationMember(conversation_id=conv.id, user_id=req.participant_id, role="member"))
        db.commit()
        db.refresh(conv)
        return build_conversation_response(conv, current_user.id, db)

    elif req.type == "group":
        if not req.name:
            raise HTTPException(status_code=400, detail="Group name required")
        if not req.member_ids:
            raise HTTPException(status_code=400, detail="At least one member required")

        conv = Conversation(
            id=str(uuid.uuid4()),
            type="group",
            name=req.name,
            created_by=current_user.id,
        )
        db.add(conv)
        db.flush()

        # Add creator as admin
        db.add(ConversationMember(conversation_id=conv.id, user_id=current_user.id, role="admin"))

        # Add other members
        for member_id in req.member_ids:
            if member_id != current_user.id:
                user = db.query(User).filter(User.id == member_id).first()
                if user:
                    db.add(ConversationMember(conversation_id=conv.id, user_id=member_id, role="member"))

        db.commit()
        db.refresh(conv)
        return build_conversation_response(conv, current_user.id, db)

    raise HTTPException(status_code=400, detail="Invalid conversation type")


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    return build_conversation_response(conv, current_user.id, db)
