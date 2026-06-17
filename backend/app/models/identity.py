"""Group 1 â€” Identity & Auth models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), unique=True, nullable=True)
    role = Column(
        String(30),
        nullable=False,
        comment="STAFF | HOD | DEAN_ACADEMIC | REGISTRAR | ESTABLISHMENT | DIRECTOR | ADMIN",
    )
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    tokens_valid_from = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="user", uselist=False)


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    jti = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)