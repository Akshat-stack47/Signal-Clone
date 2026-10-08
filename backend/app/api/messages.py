import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Message
from app.core.deps import get_current_user
from app.schemas import SendMessageRequest, MessageResponse, UpdateMessageStatusRequest, UserResponse, ReactRequest

router = APIRouter(prefix="/api/conversations", tags=["messages"])


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify membership
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    query = db.query(Message).filter(Message.conversation_id == conversation_id)

    if before:
        before_msg = db.query(Message).filter(Message.id == before).first()
        if before_msg:
            query = query.filter(Message.created_at < before_msg.created_at)

    if search:
        query = query.filter(Message.content.ilike(f"%{search}%"))

    messages = query.order_by(desc(Message.created_at)).limit(limit).all()
    messages.reverse()


    result = []
    for msg in messages:
        result.append(
            MessageResponse(
                id=msg.id,
                conversation_id=msg.conversation_id,
                sender_id=msg.sender_id,
                content=msg.content,
                message_type=msg.message_type,
                status=msg.status,
                created_at=msg.created_at,
                sender=UserResponse.model_validate(msg.sender) if msg.sender else None,
            )
        )
    return result


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: str,
    req: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify membership
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=req.content,
        message_type=req.message_type,
        status="sent",
    )
    db.add(msg)

    # Update conversation timestamp
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        conv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        content=msg.content,
        message_type=msg.message_type,
        status=msg.status,
        created_at=msg.created_at,
        sender=UserResponse.model_validate(current_user),
        temp_id=req.temp_id,
    )


@router.put("/{conversation_id}/messages/status")
def update_message_status(
    conversation_id: str,
    req: UpdateMessageStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.status not in ("delivered", "read"):
        raise HTTPException(status_code=400, detail="Status must be 'delivered' or 'read'")

    # Verify membership
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    # Update message statuses
    db.query(Message).filter(
        Message.id.in_(req.message_ids),
        Message.conversation_id == conversation_id,
        Message.sender_id != current_user.id,
    ).update({"status": req.status}, synchronize_session=False)

    # Update last_read_at for the member
    if req.status == "read":
        member.last_read_at = datetime.now(timezone.utc)

    db.commit()
    return {"updated": len(req.message_ids)}


@router.put("/{conversation_id}/read")
def mark_conversation_read(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    now = datetime.now(timezone.utc)
    member.last_read_at = now

    # Mark all unread messages as read
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != current_user.id,
        Message.status.in_(["sent", "delivered"]),
    ).update({"status": "read"}, synchronize_session=False)

    db.commit()
    return {"status": "ok"}


@router.post("/{conversation_id}/messages/{message_id}/react")
def react_to_message(
    conversation_id: str,
    message_id: str,
    req: ReactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle an emoji reaction on a message."""
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")

    msg = db.query(Message).filter(
        Message.id == message_id,
        Message.conversation_id == conversation_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = dict(msg.reactions or {})
    emoji = req.emoji
    users = reactions.get(emoji, [])

    # Toggle: add if not present, remove if present
    if current_user.id in users:
        users.remove(current_user.id)
    else:
        users.append(current_user.id)

    if users:
        reactions[emoji] = users
    else:
        reactions.pop(emoji, None)

    msg.reactions = reactions
    db.commit()
    db.refresh(msg)

    return {"message_id": message_id, "reactions": msg.reactions}
