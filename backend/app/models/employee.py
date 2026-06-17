"""Group 2 â€” Employee Master models."""

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
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class EmployeeCategory(Base):
    __tablename__ = "employee_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(
        String(20), unique=True, nullable=False,
        comment="FACULTY | NURSING | ADMIN | JR_ACAD | SR_ACAD | JR_NA | SR_NA",
    )
    name = Column(String(100), nullable=False)
    leave_scheme = Column(String(20), nullable=False, comment="CCS | RESIDENCY")
    tenure_based = Column(Boolean, default=False)
    tenure_months = Column(Integer, nullable=True, comment="36 for JR/SR Acad, 6 for JR/SR NA")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    employees = relationship("Employee", back_populates="category")
    designations = relationship("Designation", back_populates="category")
    leave_entitlement_rules = relationship("LeaveEntitlementRule", back_populates="category")


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    parent_dept_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    managing_office = Column(String(50), nullable=True, comment="ESTABLISHMENT | DEAN_ACADEMIC | REGISTRAR")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Self-referential
    parent = relationship("Department", remote_side=[id], backref="children")
    employees = relationship("Employee", back_populates="department")


class Designation(Base):
    __tablename__ = "designations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), unique=True, nullable=False)
    grade_pay_level = Column(String(20), nullable=True, comment="7th CPC pay level")
    category_id = Column(UUID(as_uuid=True), ForeignKey("employee_categories.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    category = relationship("EmployeeCategory", back_populates="designations")
    employees = relationship("Employee", back_populates="designation")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emp_code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    gender = Column(String(10), nullable=False, comment="MALE | FEMALE | OTHER")
    dob = Column(Date, nullable=True)
    doj = Column(Date, nullable=False, comment="Date of joining â€” critical for resident leave year")
    category_id = Column(UUID(as_uuid=True), ForeignKey("employee_categories.id"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    designation_id = Column(UUID(as_uuid=True), ForeignKey("designations.id"), nullable=False)
    reporting_officer_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    email = Column(String(255), nullable=True)
    has_institutional_email = Column(Boolean, default=False)
    personal_email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    category = relationship("EmployeeCategory", back_populates="employees")
    department = relationship("Department", back_populates="employees")
    designation = relationship("Designation", back_populates="employees")
    reporting_officer = relationship("Employee", remote_side=[id], backref="subordinates")
    user = relationship("User", back_populates="employee", uselist=False)
    leave_balances = relationship("LeaveBalance", back_populates="employee")
    leave_applications = relationship(
        "LeaveApplication", back_populates="employee",
        foreign_keys="LeaveApplication.employee_id"
    )