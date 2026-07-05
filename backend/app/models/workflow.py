"""Group 5 â€” Workflow Engine models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class WorkflowConfig(Base):
    __tablename__ = "workflow_configs"
    __table_args__ = (
        UniqueConstraint("config_name", "version"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_name = Column(String(200), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("employee_categories.id"), nullable=True)
    leave_type_id = Column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=True)
    min_days = Column(Integer, default=1)
    max_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    steps = relationship("WorkflowStep", back_populates="config", order_by="WorkflowStep.step_order")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    __table_args__ = (
        UniqueConstraint("config_id", "step_order"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configs.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    approver_role = Column(
        String(50), nullable=False,
        comment="HOD | NODAL_OFFICER | SPECIFIC_USER",
    )
    approver_office = Column(String(50), nullable=True)
    specific_approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    sla_hours = Column(Integer, default=48)
    is_final_authority = Column(Boolean, default=False)
    skip_if_self_applicant = Column(Boolean, default=True)
    escalation_rule = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    config = relationship("WorkflowConfig", back_populates="steps")
    approvals = relationship("LeaveApproval", back_populates="step")


class LeaveApproval(Base):
    __tablename__ = "leave_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("leave_applications.id"), nullable=False)
    step_id = Column(UUID(as_uuid=True), ForeignKey("workflow_steps.id"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    action = Column(
        String(20), nullable=False,
        comment="APPROVED | REJECTED | RETURNED | FORWARDED | MODIFIED | RECALLED",
    )
    remarks = Column(Text, nullable=True)
    modified_from_date = Column(Date, nullable=True)
    modified_to_date = Column(Date, nullable=True)
    modified_days = Column(Numeric(5, 2), nullable=True)
    acted_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    application = relationship("LeaveApplication", back_populates="approvals")
    step = relationship("WorkflowStep", back_populates="approvals")