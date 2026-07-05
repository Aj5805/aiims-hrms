"""Group 3 â€” Leave Configuration models."""

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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(
        String(20), unique=True, nullable=False,
        comment="EL | HPL | CL | ML | PL | CCL | EOL | OD | STUDY | SABBATICAL | ANNUAL_RES | COMP_OFF",
    )
    name = Column(String(100), nullable=False)
    scheme = Column(String(20), nullable=False, comment="CCS | RESIDENCY | BOTH")
    is_accumulating = Column(Boolean, default=False)
    max_accumulation = Column(Integer, nullable=True, comment="e.g., 300 for EL")
    requires_mc = Column(Boolean, default=False)
    min_days_for_mc = Column(Integer, nullable=True, comment="e.g., HPL > 3 days needs MC")
    count_holidays = Column(Boolean, default=True)
    is_half_day_allowed = Column(Boolean, default=False)
    carry_forward = Column(Boolean, default=False)
    encashable = Column(Boolean, default=False)
    validation_rules = Column(JSONB, nullable=True, comment="CL-no-prefix, EL-min-notice, etc.")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    entitlement_rules = relationship("LeaveEntitlementRule", back_populates="leave_type")
    balances = relationship("LeaveBalance", back_populates="leave_type")
    applications = relationship("LeaveApplication", back_populates="leave_type")


class LeaveEntitlementRule(Base):
    __tablename__ = "leave_entitlement_rules"
    __table_args__ = (
        UniqueConstraint("category_id", "leave_type_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("employee_categories.id"), nullable=False)
    leave_type_id = Column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    year_ref = Column(String(20), nullable=False, comment="CALENDAR | TENURE | JOINING_DATE")
    credit_frequency = Column(
        String(20),
        nullable=False,
        default="ANNUAL",
        comment="ANNUAL | HALF_YEARLY | MONTHLY | NONE",
    )
    days_per_year = Column(Numeric(5, 2), nullable=True)
    prorata_rate = Column(Numeric(4, 2), nullable=True, comment="days per month (residency: 2.5)")
    year1_days = Column(Numeric(5, 2), nullable=True, comment="JR Acad: 30, yr2/3: 36")
    year2_plus_days = Column(Numeric(5, 2), nullable=True)
    max_at_a_stretch = Column(Integer, nullable=True)
    max_in_tenure = Column(Numeric(5, 2), nullable=True, comment="EOL: 30 days per tenure")
    carry_forward = Column(Boolean, default=False)
    special_rules = Column(JSONB, nullable=True, comment="exam_extension, tenure_extension, no_combination flags")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    category = relationship("EmployeeCategory", back_populates="leave_entitlement_rules")
    leave_type = relationship("LeaveType", back_populates="entitlement_rules")


class HolidayMaster(Base):
    __tablename__ = "holiday_master"
    __table_args__ = (
        UniqueConstraint("holiday_date", "holiday_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year = Column(Integer, nullable=False)
    holiday_date = Column(Date, nullable=False)
    holiday_name = Column(String(200), nullable=False)
    holiday_type = Column(String(20), nullable=False, comment="GAZETTED | RESTRICTED | OPTIONAL")
    applicable_to = Column(String(20), default="ALL", comment="ALL | REGULAR | RESIDENT")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
