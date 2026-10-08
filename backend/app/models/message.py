import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")  # "text", "system", "image"
    status = Column(String(20), default="sent")  # "sending", "sent", "delivered", "read"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reply_to_id = Column(String(36), ForeignKey("messages.id"), nullable=True)
    reactions = Column(JSON, default=dict)  # {emoji: [user_id, ...]}

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")
    reply_to = relationship("Message", remote_side="Message.id", foreign_keys="Message.reply_to_id")

    __table_args__ = (
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )
