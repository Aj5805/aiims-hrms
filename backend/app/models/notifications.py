"""Group 6 â€” Notifications & Communication models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class NotificationQueue(Base):
    __tablename__ = "notification_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("leave_applications.id"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    channel = Column(String(10), nullable=False, comment="EMAIL | IN_APP")
    subject = Column(Text, nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String(10), default="PENDING", comment="PENDING | SENT | FAILED | SKIPPED")
    retry_count = Column(Integer, default=0)
    scheduled_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    application = relationship("LeaveApplication", back_populates="notifications")


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_code = Column(
        String(50), unique=True, nullable=False,
        comment="APP_SUBMITTED | APP_APPROVED | APP_REJECTED | APP_MODIFIED | APP_WITHDRAWN | APPROVAL_REQUEST | SLA_BREACH | BALANCE_LOW",
    )
    subject_template = Column(Text, nullable=False)
    body_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)