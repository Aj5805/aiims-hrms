"""Group 7 â€” Audit & Export models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False, comment="leave_application | leave_balance | user | etc.")
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False, comment="CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | EXPORT")
    before_state = Column(JSONB, nullable=True)
    after_state = Column(JSONB, nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class PayrollExportLog(Base):
    __tablename__ = "payroll_export_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    export_from = Column(Date, nullable=False)
    export_to = Column(Date, nullable=False)
    export_type = Column(String(20), nullable=False, comment="LOP | ENCASHMENT | FULL")
    exported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_path = Column(Text, nullable=True)
    record_count = Column(Integer, nullable=True)
    summary = Column(JSONB, nullable=True, comment="{total_lop_days, employees_affected, ...}")
    exported_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AttendanceRaw(Base):
    """Reserved for v2 biometric integration — schema ready, not populated in v1."""
    __tablename__ = "attendance_raw"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    punch_in = Column(DateTime(timezone=True), nullable=True)
    punch_out = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(20), default="BIOMETRIC")
    device_id = Column(String(50), nullable=True)
    imported_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AttendanceDaily(Base):
    """Daily attendance pipeline: leave-derived now; biometric review and finalization later."""

    __tablename__ = "attendance_daily"
    __table_args__ = (UniqueConstraint("employee_id", "attendance_date"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    leave_derived_status = Column(String(20), nullable=True, comment="ON_LEAVE | ON_DUTY")
    leave_type_code = Column(String(20), nullable=True)
    leave_application_id = Column(UUID(as_uuid=True), ForeignKey("leave_applications.id"), nullable=True)
    is_commuted = Column(Boolean, default=False)
    biometric_status = Column(String(20), nullable=True, comment="PRESENT | ABSENT | LATE | PARTIAL")
    biometric_raw_id = Column(UUID(as_uuid=True), ForeignKey("attendance_raw.id"), nullable=True)
    review_status = Column(String(20), default="PENDING", comment="PENDING | MATCHED | CONFLICT | OVERRIDDEN")
    final_status = Column(String(20), nullable=False, comment="PRESENT | ABSENT | ON_LEAVE | HOLIDAY | WEEKEND | ON_DUTY")
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    finalized_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)