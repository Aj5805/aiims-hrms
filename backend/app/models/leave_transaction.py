"""Group 4 â€” Leave Transaction models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "leave_year"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    leave_year = Column(Integer, nullable=False, comment="YYYY of year start")
    year_start_date = Column(Date, nullable=False, comment="Apr 1 for regular; joining anniversary for residents")
    opening_balance = Column(Numeric(6, 2), default=0)
    credited = Column(Numeric(6, 2), default=0)
    availed = Column(Numeric(6, 2), default=0)
    lop_days = Column(Numeric(6, 2), default=0)
    closing_balance = Column(Numeric(6, 2), Computed("opening_balance + credited - availed", persisted=True))
    last_updated = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")


class LeaveApplication(Base):
    __tablename__ = "leave_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_number = Column(String(30), unique=True, nullable=False, comment="HRMS/2026/00001 auto-generated")
    config_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configs.id"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    applied_days = Column(Numeric(5, 2), nullable=False)
    is_half_day = Column(Boolean, default=False)
    half_day_session = Column(String(10), nullable=True, comment="FN | AN")
    reason = Column(Text, nullable=False)
    address_during_leave = Column(Text, nullable=True)
    status = Column(
        String(20), default="DRAFT",
        comment="DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | RETURNED | WITHDRAWN | CANCELLED | RECALLED",
    )
    acting_arrangement_emp_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    current_step_order = Column(Integer, default=1)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_action_at = Column(DateTime(timezone=True), nullable=True)
    application_kind = Column(String(20), default="NEW", comment="NEW | CANCELLATION | MODIFICATION")
    parent_application_id = Column(UUID(as_uuid=True), ForeignKey("leave_applications.id"), nullable=True)
    mc_attached = Column(Boolean, default=False)
    is_commuted = Column(Boolean, default=False, comment="HPL commuted to full pay on MC — 2x HPL debit")
    actual_rejoin_date = Column(Date, nullable=True, comment="First day back at duty after cut-short")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_applications", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", back_populates="applications")
    acting_arrangement = relationship("Employee", foreign_keys=[acting_arrangement_emp_id])
    documents = relationship("LeaveDocument", back_populates="application")
    approvals = relationship("LeaveApproval", back_populates="application")
    notifications = relationship("NotificationQueue", back_populates="application")


class LeaveDocument(Base):
    __tablename__ = "leave_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("leave_applications.id"), nullable=False)
    doc_type = Column(String(30), nullable=False, comment="MEDICAL_CERTIFICATE | SUPPORTING_DOC | OTHER")
    file_path = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size_kb = Column(Integer, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    application = relationship("LeaveApplication", back_populates="documents")
