"""Group 8 â€” Payroll Foundation models (Reserved Schema, v1.1/v2).

No payroll logic in v1 â€” reserved structure so payroll can start
immediately after HRMS go-live without retrofitting migrations.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), unique=True, nullable=False, comment="e.g., PAY_MATRIX_7, PAY_MATRIX_11")
    name = Column(String(150), nullable=False, comment="e.g., Level 7 (PB-2)")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee_assignments = relationship("EmployeeSalaryAssignment", back_populates="structure")


class EmployeeSalaryAssignment(Base):
    __tablename__ = "employee_salary_assignments"
    __table_args__ = (
        UniqueConstraint("employee_id", "effective_from"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    structure_id = Column(UUID(as_uuid=True), ForeignKey("salary_structures.id"), nullable=False)
    basic_pay = Column(Numeric(10, 2), nullable=False)
    pay_level = Column(String(10), nullable=False, comment="e.g., Level-7, Level-11")
    grade_pay = Column(Numeric(8, 2), nullable=True)
    effective_from = Column(Date, nullable=False)
    increment_due_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    structure = relationship("SalaryStructure", back_populates="employee_assignments")