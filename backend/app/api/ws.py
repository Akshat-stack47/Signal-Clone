import json
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Message
from app.core.security import decode_access_token
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


def get_user_from_token(token: str, db: Session) -> User | None:
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


def get_conversation_member_ids(conversation_id: str, db: Session) -> list[int]:
    members = (
        db.query(ConversationMember)
        .filter(ConversationMember.conversation_id == conversation_id)
        .all()
    )
    return [m.user_id for m in members]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return

        await manager.connect(websocket, user.id)

        # Update online status
        user.is_online = True
        db.commit()

        # Broadcast presence to contacts
        from app.models.contact import Contact
        contacts = db.query(Contact).filter(Contact.user_id == user.id).all()
        contact_ids = [c.contact_user_id for c in contacts]
        # Also get users who have this user as contact
        reverse_contacts = db.query(Contact).filter(Contact.contact_user_id == user.id).all()
        all_contact_ids = list(set(contact_ids + [c.user_id for c in reverse_contacts]))
        await manager.broadcast_presence(user.id, True, all_contact_ids)

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg_data = json.loads(data)
                except json.JSONDecodeError:
                    continue

                msg_type = msg_data.get("type", "")
                conversation_id = msg_data.get("conversationId", "")
                payload = msg_data.get("data", {})

                if msg_type == "message.send":
                    await handle_send_message(user, conversation_id, payload, db)

                elif msg_type == "typing.start":
                    member_ids = get_conversation_member_ids(conversation_id, db)
                    await manager.send_to_conversation(
                        member_ids,
                        {
                            "type": "typing.start",
                            "conversationId": conversation_id,
                            "data": {"userId": user.id, "displayName": user.display_name},
                        },
                        exclude_user_id=user.id,
                    )

                elif msg_type == "typing.stop":
                    member_ids = get_conversation_member_ids(conversation_id, db)
                    await manager.send_to_conversation(
                        member_ids,
                        {
                            "type": "typing.stop",
                            "conversationId": conversation_id,
                            "data": {"userId": user.id},
                        },
                        exclude_user_id=user.id,
                    )

                elif msg_type == "message.read":
                    await handle_read_receipt(user, conversation_id, payload, db)

                elif msg_type == "message.delivered":
                    await handle_delivered_receipt(user, conversation_id, payload, db)

        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(user.id)
            user.is_online = False
            user.last_seen = datetime.now(timezone.utc)
            db.commit()
            await manager.broadcast_presence(user.id, False, all_contact_ids)
    finally:
        db.close()


async def handle_send_message(user: User, conversation_id: str, payload: dict, db: Session):
    content = payload.get("content", "").strip()
    if not content:
        return

    temp_id = payload.get("tempId")
    msg_type = payload.get("messageType", "text")

    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        sender_id=user.id,
        content=content,
        message_type=msg_type,
        status="sent",
    )
    db.add(msg)

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        conv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)

    msg_response = {
        "type": "message.new",
        "conversationId": conversation_id,
        "data": {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "message_type": msg.message_type,
            "status": msg.status,
            "created_at": msg.created_at.isoformat(),
            "sender": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "is_online": True,
            },
            "temp_id": temp_id,
        },
    }

    member_ids = get_conversation_member_ids(conversation_id, db)

    # Send to sender with "sent" confirmation
    await manager.send_personal(user.id, {
        "type": "message.sent",
        "conversationId": conversation_id,
        "data": {
            **msg_response["data"],
            "tempId": temp_id,
            "temp_id": temp_id,
        },
    })

    # Send to other members
    await manager.send_to_conversation(member_ids, msg_response, exclude_user_id=user.id)

    # Mark as delivered for online recipients
    for member_id in member_ids:
        if member_id != user.id and manager.is_online(member_id):
            msg.status = "delivered"
            db.commit()
            await manager.send_personal(user.id, {
                "type": "message.delivered",
                "conversationId": conversation_id,
                "data": {"messageId": msg.id},
            })
            break


async def handle_read_receipt(user: User, conversation_id: str, payload: dict, db: Session):
    message_ids = payload.get("messageIds", [])
    if not message_ids:
        return

    # Update in DB
    db.query(Message).filter(
        Message.id.in_(message_ids),
        Message.conversation_id == conversation_id,
        Message.sender_id != user.id,
    ).update({"status": "read"}, synchronize_session=False)

    # Update last_read_at
    member = (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user.id,
        )
        .first()
    )
    if member:
        member.last_read_at = datetime.now(timezone.utc)

    db.commit()

    # Notify message senders
    messages = db.query(Message).filter(Message.id.in_(message_ids)).all()
    sender_ids = set(m.sender_id for m in messages if m.sender_id != user.id)
    for sender_id in sender_ids:
        await manager.send_personal(sender_id, {
            "type": "message.read",
            "conversationId": conversation_id,
            "data": {
                "messageIds": message_ids,
                "readBy": user.id,
            },
        })


async def handle_delivered_receipt(user: User, conversation_id: str, payload: dict, db: Session):
    message_ids = payload.get("messageIds", [])
    if not message_ids:
        return

    db.query(Message).filter(
        Message.id.in_(message_ids),
        Message.conversation_id == conversation_id,
        Message.sender_id != user.id,
        Message.status == "sent",
    ).update({"status": "delivered"}, synchronize_session=False)
    db.commit()

    messages = db.query(Message).filter(Message.id.in_(message_ids)).all()
    sender_ids = set(m.sender_id for m in messages if m.sender_id != user.id)
    for sender_id in sender_ids:
        await manager.send_personal(sender_id, {
            "type": "message.delivered",
            "conversationId": conversation_id,
            "data": {"messageIds": message_ids},
        })
