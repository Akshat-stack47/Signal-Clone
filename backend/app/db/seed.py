import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, init_db
from app.models.user import User
from app.models.contact import Contact
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Message
from app.core.security import hash_password
from app.core.config import settings


def seed_database():
    """Seed the database with demo data."""
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(User).count() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # ─── Create Users ─────────────────────────────────────
        users_data = [
            {"username": "alice", "display_name": "Alice Johnson", "phone": "+1234567001", "about": "Privacy matters."},
            {"username": "bob", "display_name": "Bob Smith", "phone": "+1234567002", "about": "Keeping it simple."},
            {"username": "charlie", "display_name": "Charlie Brown", "phone": "+1234567003", "about": "Available"},
            {"username": "david", "display_name": "David Wilson", "phone": "+1234567004", "about": "Hey there! I am using Signal"},
            {"username": "emma", "display_name": "Emma Davis", "phone": "+1234567005", "about": "End-to-end encrypted"},
        ]

        users = []
        for ud in users_data:
            user = User(
                username=ud["username"],
                display_name=ud["display_name"],
                phone=ud["phone"],
                about=ud["about"],
                password_hash=hash_password(settings.MOCK_OTP),
                is_online=False,
                last_seen=datetime.now(timezone.utc) - timedelta(minutes=5),
            )
            db.add(user)
            users.append(user)

        db.flush()

        alice, bob, charlie, david, emma = users

        # ─── Create Contacts ─────────────────────────────────
        contact_pairs = [
            (alice, bob), (alice, charlie), (alice, david), (alice, emma),
            (bob, alice), (bob, charlie), (bob, emma),
            (charlie, alice), (charlie, bob), (charlie, david),
            (david, alice), (david, charlie), (david, emma),
            (emma, alice), (emma, bob), (emma, david),
        ]
        for user, contact in contact_pairs:
            db.add(Contact(user_id=user.id, contact_user_id=contact.id))

        db.flush()

        # ─── Create Direct Conversations ──────────────────────
        now = datetime.now(timezone.utc)

        # Alice ↔ Bob
        conv_ab = Conversation(id=str(uuid.uuid4()), type="direct", created_by=alice.id, updated_at=now - timedelta(minutes=2))
        db.add(conv_ab)
        db.flush()
        db.add(ConversationMember(conversation_id=conv_ab.id, user_id=alice.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=conv_ab.id, user_id=bob.id, role="member", last_read_at=now - timedelta(minutes=10)))

        # Alice ↔ Charlie
        conv_ac = Conversation(id=str(uuid.uuid4()), type="direct", created_by=alice.id, updated_at=now - timedelta(hours=1))
        db.add(conv_ac)
        db.flush()
        db.add(ConversationMember(conversation_id=conv_ac.id, user_id=alice.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=conv_ac.id, user_id=charlie.id, role="member", last_read_at=now))

        # Bob ↔ Emma
        conv_be = Conversation(id=str(uuid.uuid4()), type="direct", created_by=bob.id, updated_at=now - timedelta(hours=3))
        db.add(conv_be)
        db.flush()
        db.add(ConversationMember(conversation_id=conv_be.id, user_id=bob.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=conv_be.id, user_id=emma.id, role="member", last_read_at=now))

        # David ↔ Emma
        conv_de = Conversation(id=str(uuid.uuid4()), type="direct", created_by=david.id, updated_at=now - timedelta(hours=5))
        db.add(conv_de)
        db.flush()
        db.add(ConversationMember(conversation_id=conv_de.id, user_id=david.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=conv_de.id, user_id=emma.id, role="member", last_read_at=now))

        db.flush()

        # ─── Create Group Conversation ────────────────────────
        group = Conversation(
            id=str(uuid.uuid4()),
            type="group",
            name="Signal Dev Team",
            created_by=alice.id,
            updated_at=now - timedelta(minutes=30),
        )
        db.add(group)
        db.flush()
        db.add(ConversationMember(conversation_id=group.id, user_id=alice.id, role="admin", last_read_at=now))
        db.add(ConversationMember(conversation_id=group.id, user_id=bob.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=group.id, user_id=charlie.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=group.id, user_id=emma.id, role="member", last_read_at=now))

        # Second group
        group2 = Conversation(
            id=str(uuid.uuid4()),
            type="group",
            name="Weekend Plans",
            created_by=bob.id,
            updated_at=now - timedelta(hours=2),
        )
        db.add(group2)
        db.flush()
        db.add(ConversationMember(conversation_id=group2.id, user_id=bob.id, role="admin", last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=alice.id, role="member", last_read_at=now))
        db.add(ConversationMember(conversation_id=group2.id, user_id=david.id, role="member", last_read_at=now))

        db.flush()

        # --- Create Messages ---
        # Alice <-> Bob conversation
        messages_ab = [
            (alice, "Hey Bob! Have you checked out the new Signal update?", now - timedelta(minutes=30)),
            (bob, "Not yet! What's new?", now - timedelta(minutes=28)),
            (alice, "They added some really cool privacy features", now - timedelta(minutes=25)),
            (bob, "That's awesome! I'll check it out tonight", now - timedelta(minutes=20)),
            (alice, "Also, are we still on for the code review tomorrow?", now - timedelta(minutes=10)),
            (bob, "Yes! 10am works for me. I'll prepare the PR.", now - timedelta(minutes=5)),
            (alice, "Perfect. See you then!", now - timedelta(minutes=2)),
        ]

        for sender, content, ts in messages_ab:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_ab.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        # Alice ↔ Charlie conversation
        messages_ac = [
            (charlie, "Hey Alice, quick question about the API design", now - timedelta(hours=2)),
            (alice, "Sure, what's up?", now - timedelta(hours=1, minutes=55)),
            (charlie, "Should we use REST or GraphQL for the new service?", now - timedelta(hours=1, minutes=50)),
            (alice, "REST for now. We can always add GraphQL later if needed", now - timedelta(hours=1, minutes=45)),
            (charlie, "Makes sense. Thanks!", now - timedelta(hours=1)),
        ]

        for sender, content, ts in messages_ac:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_ac.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        # Bob ↔ Emma
        messages_be = [
            (emma, "Bob, did you finish the frontend components?", now - timedelta(hours=4)),
            (bob, "Almost done! Just polishing the responsive layout", now - timedelta(hours=3, minutes=30)),
            (emma, "Great! Let me know when I can review", now - timedelta(hours=3)),
        ]

        for sender, content, ts in messages_be:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_be.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        # David ↔ Emma
        messages_de = [
            (david, "Emma, the deployment pipeline is ready", now - timedelta(hours=6)),
            (emma, "Awesome! I'll trigger a test deployment", now - timedelta(hours=5, minutes=30)),
            (david, "Let me know if you run into any issues", now - timedelta(hours=5)),
        ]

        for sender, content, ts in messages_de:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_de.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        # Group messages - Signal Dev Team
        group_messages = [
            (alice, "Welcome to the Signal Dev Team group!", now - timedelta(hours=4)),
            (bob, "Thanks for setting this up, Alice!", now - timedelta(hours=3, minutes=50)),
            (charlie, "This will be great for coordinating our work", now - timedelta(hours=3, minutes=40)),
            (emma, "Agreed! Let's use this for all project updates", now - timedelta(hours=3, minutes=30)),
            (alice, "Sprint planning is tomorrow at 2pm. Everyone prepared?", now - timedelta(minutes=45)),
            (bob, "Ready! I have my tickets prioritized", now - timedelta(minutes=40)),
            (charlie, "Same here", now - timedelta(minutes=35)),
            (emma, "I'll share the metrics dashboard before the meeting", now - timedelta(minutes=30)),
        ]

        for sender, content, ts in group_messages:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=group.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        # Group messages - Weekend Plans
        group2_messages = [
            (bob, "Anyone up for hiking this weekend?", now - timedelta(hours=3)),
            (alice, "Count me in! Where are we going?", now - timedelta(hours=2, minutes=45)),
            (david, "How about the mountain trail?", now - timedelta(hours=2, minutes=30)),
            (bob, "Perfect! Let's meet at 8am Saturday", now - timedelta(hours=2)),
        ]

        for sender, content, ts in group2_messages:
            db.add(Message(
                id=str(uuid.uuid4()),
                conversation_id=group2.id,
                sender_id=sender.id,
                content=content,
                status="read",
                created_at=ts,
            ))

        db.commit()
        print("[OK] Database seeded successfully!")
        print("Demo accounts: alice, bob, charlie, david, emma")
        print("OTP for all: 123456")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
