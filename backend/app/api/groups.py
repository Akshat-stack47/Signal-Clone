import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember
from app.core.deps import get_current_user
from app.schemas import (
    CreateGroupRequest,
    AddGroupMemberRequest,
    ConversationResponse,
    ConversationMemberResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


def _check_admin(conversation_id: str, user_id: int, db: Session) -> ConversationMember:
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
        .first()
    )
    if not member or member.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return member


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    req: CreateGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = Conversation(
        id=str(uuid.uuid4()),
        type="group",
        name=req.name,
        avatar_url=req.avatar_url,
        created_by=current_user.id,
    )
    db.add(conv)
    db.flush()

    # Creator is admin
    db.add(ConversationMember(conversation_id=conv.id, user_id=current_user.id, role="admin"))

    for member_id in req.member_ids:
        if member_id != current_user.id:
            user = db.query(User).filter(User.id == member_id).first()
            if user:
                db.add(ConversationMember(conversation_id=conv.id, user_id=member_id, role="member"))

    db.commit()
    db.refresh(conv)

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

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        avatar_url=conv.avatar_url,
        created_by=conv.created_by,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        members=members_resp,
        unread_count=0,
    )


@router.get("/{group_id}", response_model=ConversationResponse)
def get_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(Conversation.id == group_id, Conversation.type == "group").first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")

    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")

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

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        avatar_url=conv.avatar_url,
        created_by=conv.created_by,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        members=members_resp,
        unread_count=0,
    )


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
def add_group_member(
    group_id: str,
    req: AddGroupMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_admin(group_id, current_user.id, db)

    # Check user exists
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already member
    existing = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == group_id,
            ConversationMember.user_id == req.user_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member")

    member = ConversationMember(conversation_id=group_id, user_id=req.user_id, role="member")
    db.add(member)
    db.commit()
    return {"message": "Member added", "user_id": req.user_id}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group_member(
    group_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Allow self-removal (leave group) OR admin removing others
    is_self = user_id == current_user.id
    if not is_self:
        _check_admin(group_id, current_user.id, db)

    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == group_id,
            ConversationMember.user_id == user_id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()

