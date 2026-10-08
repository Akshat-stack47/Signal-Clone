from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.core.deps import get_current_user
from app.schemas import AddContactRequest, ContactResponse, UserResponse

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactResponse])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contacts = (
        db.query(Contact)
        .filter(Contact.user_id == current_user.id)
        .all()
    )
    return contacts


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def add_contact(
    req: AddContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact_user = db.query(User).filter(User.username == req.username).first()
    if not contact_user:
        raise HTTPException(status_code=404, detail="User not found")

    if contact_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as contact")

    existing = (
        db.query(Contact)
        .filter(
            Contact.user_id == current_user.id,
            Contact.contact_user_id == contact_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Contact already exists")

    contact = Contact(user_id=current_user.id, contact_user_id=contact_user.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
