# AIIMS HRMS — Phase 1: Database Schema + Seeds

> **For AI agent consumption.** Each section = one file.   
> **Heading** = relative file path from `aiims-hrms/`. **Code block** = file content.   
> Place every file at its path inside the existing repo.   
> **Prerequisite:** Phase 0 scaffolding must already be in place.   

---

## PHASE 1 SCOPE

- **9 SQLAlchemy model files** — 21 tables across Groups 1–8
- **Alembic migration** `0001_initial_schema.py` — creates all tables, extensions, triggers, constraints
- **Updated** `alembic/env.py` — wired to `Base.metadata`
- **6 seed scripts** — categories, leave types, CCS rules, resident rules, email templates, workflows

### Tables created (21 total)

| Group | Tables |
|-------|--------|
| 1 — Identity & Auth | `users`, `token_blacklist` |
| 2 — Employee Master | `employee_categories`, `departments`, `designations`, `employees` |
| 3 — Leave Config | `leave_types`, `leave_entitlement_rules`, `holiday_master` |
| 4 — Leave Transactions | `leave_balances`, `leave_applications`, `leave_documents` |
| 5 — Workflow | `workflow_configs`, `workflow_steps`, `leave_approvals` |
| 6 — Notifications | `notification_queue`, `email_templates` |
| 7 — Audit & Export | `audit_log`, `payroll_export_log`, `attendance_raw` |
| 8 — Payroll (reserved) | `salary_structures`, `employee_salary_assignments` |

### What to do with files that already exist

- **`backend/alembic/env.py`** — OVERWRITE (Phase 0 version had `target_metadata = None`)
- **All other files** — CREATE NEW (they don't exist yet)

---

## VERIFICATION AFTER PLACEMENT

```bash
# 1. Start DB + install deps
cd aiims-hrms
docker compose up -d db
cd backend && pip install -e '.[dev]'

# 2. Run migration
alembic upgrade head
# Should print: Running upgrade  -> 0001

# 3. Verify all 21 tables exist
psql -h localhost -U aiims_hrms -d aiims_hrms -c '\dt'
# Should show 21 tables + partitions

# 4. Run seeds
cd backend && python -m seeds.run
# Should print: Seeded 7 employee categories / 13 leave types / ... / All seeds complete.

# 5. Verify audit log immutability
psql ... -c "DELETE FROM audit_log;"  # Should raise: audit_log is append-only

# 6. Verify overlap constraint
# Manual: try inserting two overlapping APPROVED leave_applications for same employee
# Should violate no_overlapping_approved_leave constraint
```

---

### FILE: `backend/app/models/__init__.py`

```python
"""All SQLAlchemy models — import everything so Alembic can detect them."""

from app.models.base import Base
from app.models.identity import User, TokenBlacklist
from app.models.employee import EmployeeCategory, Department, Designation, Employee
from app.models.leave_config import LeaveType, LeaveEntitlementRule, HolidayMaster
from app.models.leave_transaction import LeaveBalance, LeaveApplication, LeaveDocument
from app.models.workflow import WorkflowConfig, WorkflowStep, LeaveApproval
from app.models.notifications import NotificationQueue, EmailTemplate
from app.models.audit import AuditLog, PayrollExportLog, AttendanceRaw
from app.models.payroll import SalaryStructure, EmployeeSalaryAssignment

__all__ = [
    "Base",
    # Identity
    "User",
    "TokenBlacklist",
    # Employee
    "EmployeeCategory",
    "Department",
    "Designation",
    "Employee",
    # Leave Config
    "LeaveType",
    "LeaveEntitlementRule",
    "HolidayMaster",
    # Leave Transactions
    "LeaveBalance",
    "LeaveApplication",
    "LeaveDocument",
    # Workflow
    "WorkflowConfig",
    "WorkflowStep",
    "LeaveApproval",
    # Notifications
    "NotificationQueue",
    "EmailTemplate",
    # Audit
    "AuditLog",
    "PayrollExportLog",
    "AttendanceRaw",
    # Payroll
    "SalaryStructure",
    "EmployeeSalaryAssignment",
]
```

---

### FILE: `backend/app/models/base.py`

```python
"""SQLAlchemy declarative base and shared utilities."""

from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData

# Naming convention for auto-generated constraint/index names
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)
Base = declarative_base(metadata=metadata)
```

---

### FILE: `backend/app/models/identity.py`

```python
"""Group 1 — Identity & Auth models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
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
```

---

### FILE: `backend/app/models/employee.py`

```python
"""Group 2 — Employee Master models."""

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
    name = Column(String(150), nullable=False)
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
    doj = Column(Date, nullable=False, comment="Date of joining — critical for resident leave year")
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
    leave_applications = relationship("LeaveApplication", back_populates="employee", foreign_keys="LeaveApplication.employee_id")
```

---

### FILE: `backend/app/models/leave_config.py`

```python
"""Group 3 — Leave Configuration models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
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
    year_ref = Column(String(20), nullable=False, comment="FINANCIAL | CALENDAR | JOINING_DATE")
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
```

---

### FILE: `backend/app/models/leave_transaction.py`

```python
"""Group 4 — Leave Transaction models."""

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
    closing_balance = Column(
        Numeric(6, 2),
        nullable=False,
        server_default="0",
        comment="GENERATED ALWAYS AS (opening_balance + credited - availed) STORED — computed at app level",
    )
    last_updated = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")


class LeaveApplication(Base):
    __tablename__ = "leave_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_number = Column(String(30), unique=True, nullable=False, comment="HRMS/2026/00001 auto-generated")
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
```

---

### FILE: `backend/app/models/workflow.py`

```python
"""Group 5 — Workflow Engine models."""

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
        comment="HOD | DEAN_ACADEMIC | ESTABLISHMENT_OFFICER | REGISTRAR | DIRECTOR | SPECIFIC_USER",
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
```

---

### FILE: `backend/app/models/notifications.py`

```python
"""Group 6 — Notifications & Communication models."""

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
```

---

### FILE: `backend/app/models/audit.py`

```python
"""Group 7 — Audit & Export models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False, comment="leave_application | leave_balance | workflow_config | user | etc.")
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
```

---

### FILE: `backend/app/models/payroll.py`

```python
"""Group 8 — Payroll Foundation models (Reserved Schema, v1.1/v2).

No payroll logic in v1 — this is reserved structure so payroll can start
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
```

---

### FILE: `backend/alembic/versions/0001_initial_schema.py`

```python
"""0001_initial_schema

Creates all 21 tables for AIIMS HRMS (Groups 1–8):
  Group 1:   users, token_blacklist
  Group 2:   employee_categories, departments, designations, employees
  Group 3:   leave_types, leave_entitlement_rules, holiday_master
  Group 4:   leave_balances, leave_applications, leave_documents
  Group 5:   workflow_configs, workflow_steps, leave_approvals
  Group 6:   notification_queue, email_templates
  Group 7:   audit_log, payroll_export_log, attendance_raw
  Group 8:   salary_structures, employee_salary_assignments

Also:
  - Enables btree_gist extension
  - Creates audit_log immutability trigger
  - Creates audit_log yearly partitions (2026, 2027)
  - Creates leave_applications exclusion constraint (overlap prevention)

Revision ID: 0001
Revises: None
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ── Extensions ──────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # ═══════════════════════════════════════════════════════════════════════
    # Group 1 — Identity & Auth
    # ═══════════════════════════════════════════════════════════════════════

    # Need employees table first (FK target), but we create it out of order.
    # We'll create employee_categories, departments, designations first,
    # then employees, then users.

    # ═══════════════════════════════════════════════════════════════════════
    # Group 2 — Employee Master (FK-free tables first)
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "employee_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("leave_scheme", sa.String(20), nullable=False),
        sa.Column("tenure_based", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("tenure_months", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("parent_dept_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("managing_office", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "designations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("grade_pay_level", sa.String(20), nullable=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employee_categories.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("emp_code", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("dob", sa.Date(), nullable=True),
        sa.Column("doj", sa.Date(), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employee_categories.id"), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=False),
        sa.Column("designation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("designations.id"), nullable=False),
        sa.Column("reporting_officer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("has_institutional_email", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("personal_email", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Now users (depends on employees)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), unique=True, nullable=True),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("must_change_password", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "token_blacklist",
        sa.Column("jti", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_token_blacklist_expires_at", "token_blacklist", ["expires_at"])

    # ═══════════════════════════════════════════════════════════════════════
    # Group 3 — Leave Configuration
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "leave_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("scheme", sa.String(20), nullable=False),
        sa.Column("is_accumulating", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("max_accumulation", sa.Integer(), nullable=True),
        sa.Column("requires_mc", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("min_days_for_mc", sa.Integer(), nullable=True),
        sa.Column("count_holidays", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_half_day_allowed", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("carry_forward", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("encashable", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("validation_rules", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "leave_entitlement_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employee_categories.id"), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("year_ref", sa.String(20), nullable=False),
        sa.Column("days_per_year", sa.Numeric(5, 2), nullable=True),
        sa.Column("prorata_rate", sa.Numeric(4, 2), nullable=True),
        sa.Column("year1_days", sa.Numeric(5, 2), nullable=True),
        sa.Column("year2_plus_days", sa.Numeric(5, 2), nullable=True),
        sa.Column("max_at_a_stretch", sa.Integer(), nullable=True),
        sa.Column("max_in_tenure", sa.Numeric(5, 2), nullable=True),
        sa.Column("carry_forward", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("special_rules", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("category_id", "leave_type_id"),
    )

    op.create_table(
        "holiday_master",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("holiday_name", sa.String(200), nullable=False),
        sa.Column("holiday_type", sa.String(20), nullable=False),
        sa.Column("applicable_to", sa.String(20), server_default="ALL"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("holiday_date", "holiday_type"),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Group 4 — Leave Transactions
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "leave_balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("leave_year", sa.Integer(), nullable=False),
        sa.Column("year_start_date", sa.Date(), nullable=False),
        sa.Column("opening_balance", sa.Numeric(6, 2), server_default="0"),
        sa.Column("credited", sa.Numeric(6, 2), server_default="0"),
        sa.Column("availed", sa.Numeric(6, 2), server_default="0"),
        sa.Column("lop_days", sa.Numeric(6, 2), server_default="0"),
        sa.Column("closing_balance", sa.Numeric(6, 2), server_default="0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("employee_id", "leave_type_id", "leave_year"),
    )

    op.create_table(
        "leave_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("app_number", sa.String(30), unique=True, nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("applied_days", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_half_day", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("half_day_session", sa.String(10), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("address_during_leave", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="DRAFT"),
        sa.Column("acting_arrangement_emp_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("current_step_order", sa.Integer(), server_default="1"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Overlap exclusion constraint
    op.execute("""
        ALTER TABLE leave_applications
        ADD CONSTRAINT no_overlapping_approved_leave
        EXCLUDE USING gist (
            employee_id WITH =,
            daterange(from_date, to_date, '[]') WITH &&
        ) WHERE (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED'))
    """)

    op.create_table(
        "leave_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_applications.id"), nullable=False),
        sa.Column("doc_type", sa.String(30), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_size_kb", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Group 5 — Workflow Engine
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "workflow_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("config_name", sa.String(200), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employee_categories.id"), nullable=True),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_types.id"), nullable=True),
        sa.Column("min_days", sa.Integer(), server_default="1"),
        sa.Column("max_days", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "workflow_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_configs.id"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("approver_role", sa.String(50), nullable=False),
        sa.Column("approver_office", sa.String(50), nullable=True),
        sa.Column("specific_approver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sla_hours", sa.Integer(), server_default="48"),
        sa.Column("is_final_authority", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("skip_if_self_applicant", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("escalation_rule", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("config_id", "step_order"),
    )

    op.create_table(
        "leave_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_applications.id"), nullable=False),
        sa.Column("step_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_steps.id"), nullable=False),
        sa.Column("approver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("modified_from_date", sa.Date(), nullable=True),
        sa.Column("modified_to_date", sa.Date(), nullable=True),
        sa.Column("modified_days", sa.Numeric(5, 2), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Group 6 — Notifications & Communication
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "notification_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_applications.id"), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("channel", sa.String(10), nullable=False),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), server_default="PENDING"),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "email_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("event_code", sa.String(50), unique=True, nullable=False),
        sa.Column("subject_template", sa.Text(), nullable=False),
        sa.Column("body_template", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Group 7 — Audit & Export
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Audit log immutability trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_log_no_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only — UPDATE and DELETE are not permitted';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_audit_log_no_update
        BEFORE UPDATE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutation();

        CREATE TRIGGER trg_audit_log_no_delete
        BEFORE DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutation();
    """)

    # Yearly partitions for audit_log
    for year in [2026, 2027]:
        op.execute(f"""
            CREATE TABLE audit_log_{year} (
                LIKE audit_log INCLUDING DEFAULTS INCLUDING CONSTRAINTS
            );
            ALTER TABLE audit_log_{year} INHERIT audit_log;
        """)

    # Indexes on audit_log
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("ix_audit_log_actor", "audit_log", ["actor_id"])

    op.create_table(
        "payroll_export_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("export_from", sa.Date(), nullable=False),
        sa.Column("export_to", sa.Date(), nullable=False),
        sa.Column("export_type", sa.String(20), nullable=False),
        sa.Column("exported_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("record_count", sa.Integer(), nullable=True),
        sa.Column("summary", postgresql.JSONB(), nullable=True),
        sa.Column("exported_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "attendance_raw",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("punch_in", sa.DateTime(timezone=True), nullable=True),
        sa.Column("punch_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(20), server_default="BIOMETRIC"),
        sa.Column("device_id", sa.String(50), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Group 8 — Payroll Foundation (Reserved, v1.1/v2)
    # ═══════════════════════════════════════════════════════════════════════

    op.create_table(
        "salary_structures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("code", sa.String(30), unique=True, nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "employee_salary_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("structure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("salary_structures.id"), nullable=False),
        sa.Column("basic_pay", sa.Numeric(10, 2), nullable=False),
        sa.Column("pay_level", sa.String(10), nullable=False),
        sa.Column("grade_pay", sa.Numeric(8, 2), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("increment_due_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("employee_id", "effective_from"),
    )


def downgrade():
    # Drop in reverse dependency order
    op.drop_table("employee_salary_assignments")
    op.drop_table("salary_structures")
    op.drop_table("attendance_raw")
    op.drop_table("payroll_export_log")

    # Drop audit log partitions and trigger
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS audit_log_no_mutation()")
    for year in [2026, 2027]:
        op.execute(f"DROP TABLE IF EXISTS audit_log_{year}")
    op.drop_table("audit_log")

    op.drop_table("email_templates")
    op.drop_table("notification_queue")
    op.drop_table("leave_approvals")
    op.drop_table("workflow_steps")
    op.drop_table("workflow_configs")

    # Remove exclusion constraint before dropping table
    op.execute("ALTER TABLE leave_applications DROP CONSTRAINT IF EXISTS no_overlapping_approved_leave")

    op.drop_table("leave_documents")
    op.drop_table("leave_applications")
    op.drop_table("leave_balances")
    op.drop_table("holiday_master")
    op.drop_table("leave_entitlement_rules")
    op.drop_table("leave_types")
    op.drop_table("token_blacklist")
    op.drop_table("users")
    op.drop_table("employees")
    op.drop_table("designations")
    op.drop_table("departments")
    op.drop_table("employee_categories")
```

---

### FILE: `backend/alembic/env.py`

⚠️ **OVERWRITE** — this replaces the Phase 0 version.

```python
"""Updated Alembic env.py — uses Base.metadata from models."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.models import Base  # Now imports all models

# Alembic Config object
config = context.config

# Set the database URL from our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata from all models
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

### FILE: `backend/seeds/run.py`

```python
"""Base seed runner — loads seed scripts in order against the database.

Usage:
    cd backend && python seeds/run.py

Each seed in seeds/versions/ is executed in filename order.
Seeds are idempotent (safe to re-run).
"""

import importlib
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings


def run_seeds():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    versions_dir = os.path.join(os.path.dirname(__file__), "versions")

    # Get all seed files in order
    seed_files = sorted(
        f for f in os.listdir(versions_dir)
        if f.endswith(".py") and f != "__init__.py"
    )

    print(f"Found {len(seed_files)} seed scripts.")

    with Session(engine) as session:
        for seed_file in seed_files:
            mod_name = f"seeds.versions.{seed_file[:-3]}"
            print(f"  Running: {seed_file} ... ", end="")
            try:
                mod = importlib.import_module(mod_name)
                mod.run(session)
                session.commit()
                print("OK")
            except Exception as e:
                session.rollback()
                print(f"FAILED — {e}")
                raise

    print("All seeds complete.")


if __name__ == "__main__":
    run_seeds()
```

---

### FILE: `backend/seeds/__init__.py`

```python
"""Seeds package."""
```

---

### FILE: `backend/seeds/versions/__init__.py`

```python
"""Seeds versions package."""
```

---

### FILE: `backend/seeds/versions/001_employee_categories.py`

```python
"""Seed 001 — Employee categories (7 categories)."""

from sqlalchemy import text

CATEGORIES = [
    ("FACULTY", "Faculty", "CCS", False, None),
    ("NURSING", "Nursing Staff", "CCS", False, None),
    ("ADMIN", "Non-Faculty / Administration", "CCS", False, None),
    ("JR_ACAD", "Junior Resident (Academic)", "RESIDENCY", True, 36),
    ("SR_ACAD", "Senior Resident (Academic)", "RESIDENCY", True, 36),
    ("JR_NA", "Junior Resident (Non-Academic)", "RESIDENCY", True, 6),
    ("SR_NA", "Senior Resident (Non-Academic)", "RESIDENCY", True, 6),
]


def run(session):
    for code, name, scheme, tenure_based, tenure_months in CATEGORIES:
        existing = session.execute(
            text("SELECT id FROM employee_categories WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO employee_categories (code, name, leave_scheme, tenure_based, tenure_months)
                VALUES (:code, :name, :scheme, :tenure_based, :tenure_months)
            """),
            {
                "code": code,
                "name": name,
                "scheme": scheme,
                "tenure_based": tenure_based,
                "tenure_months": tenure_months,
            },
        )
    print(f"Seeded {len(CATEGORIES)} employee categories.")
```

---

### FILE: `backend/seeds/versions/002_leave_types.py`

```python
"""Seed 002 — Leave types (all CCS + Residency)."""

from sqlalchemy import text

LEAVE_TYPES = [
    # CCS Leave Types
    ("EL", "Earned Leave", "CCS", True, 300, False, None, True, False, True, None),
    ("HPL", "Half Pay Leave", "CCS", False, None, True, 3, True, False, False, None),
    ("CL", "Casual Leave", "CCS", False, None, False, None, False, True, False,
     '{"no_prefix_suffix_holidays": true, "no_combination": true, "max_per_stretch": 5}'),
    ("ML", "Maternity Leave", "BOTH", False, None, True, 1, True, False, False, None),
    ("PL", "Paternity Leave", "BOTH", False, None, False, None, True, False, False, None),
    ("CCL", "Child Care Leave", "CCS", False, None, False, None, True, False, False, None),
    ("EOL", "Extraordinary Leave", "BOTH", False, None, False, None, True, False, False, None),
    ("OD", "On Duty", "CCS", False, None, False, None, True, True, False, None),
    ("STUDY", "Study Leave", "CCS", False, None, False, None, True, False, False, None),
    ("SABBATICAL", "Sabbatical Leave", "CCS", False, None, False, None, True, False, False, None),
    ("COMMUTED", "Commuted Leave", "CCS", False, None, True, 1, True, False, False, None),
    ("COMP_OFF", "Compensatory Off", "CCS", False, None, False, None, False, True, False,
     '{"requires_remarks": true, "requires_attachment": true}'),
    # Residency Leave Types
    ("ANNUAL_RES", "Annual Leave (Resident)", "RESIDENCY", False, None, False, None, True, True, False, None),
]


def run(session):
    for (code, name, scheme, is_acc, max_acc, requires_mc, min_mc,
         count_hol, half_day, carry_fwd, validation_rules) in LEAVE_TYPES:
        existing = session.execute(
            text("SELECT id FROM leave_types WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO leave_types
                    (code, name, scheme, is_accumulating, max_accumulation,
                     requires_mc, min_days_for_mc, count_holidays,
                     is_half_day_allowed, carry_forward, validation_rules)
                VALUES
                    (:code, :name, :scheme, :is_acc, :max_acc,
                     :requires_mc, :min_mc, :count_hol,
                     :half_day, :carry_fwd, :vrules::jsonb)
            """),
            {
                "code": code, "name": name, "scheme": scheme,
                "is_acc": is_acc, "max_acc": max_acc,
                "requires_mc": requires_mc, "min_mc": min_mc,
                "count_hol": count_hol, "half_day": half_day,
                "carry_fwd": carry_fwd, "vrules": validation_rules,
            },
        )
    print(f"Seeded {len(LEAVE_TYPES)} leave types.")
```

---

### FILE: `backend/seeds/versions/003_ccs_entitlement_rules.py`

```python
"""Seed 003 — CCS leave entitlement rules for Regular Staff."""

from sqlalchemy import text


def _get_category_id(session, code):
    return session.execute(
        text("SELECT id FROM employee_categories WHERE code = :code"),
        {"code": code},
    ).fetchone()[0]


def _get_leave_type_id(session, code):
    return session.execute(
        text("SELECT id FROM leave_types WHERE code = :code"),
        {"code": code},
    ).fetchone()[0]


CCS_RULES = [
    # (category_code, leave_type_code, year_ref, days_per_year, prorata, yr1, yr2+,
    #  max_stretch, max_tenure, carry_fwd, special_rules)
    ("FACULTY", "EL", "FINANCIAL", 30, None, 15, 30, None, None, True, None),
    ("NURSING", "EL", "FINANCIAL", 30, None, 15, 30, None, None, True, None),
    ("ADMIN", "EL", "FINANCIAL", 30, None, 15, 30, None, None, True, None),
    ("FACULTY", "HPL", "FINANCIAL", 20, None, 10, 20, None, None, False, None),
    ("NURSING", "HPL", "FINANCIAL", 20, None, 10, 20, None, None, False, None),
    ("ADMIN", "HPL", "FINANCIAL", 20, None, 10, 20, None, None, False, None),
    ("FACULTY", "CL", "CALENDAR", 8, None, 8, 8, 5, None, False, None),
    ("NURSING", "CL", "CALENDAR", 8, None, 8, 8, 5, None, False, None),
    ("ADMIN", "CL", "CALENDAR", 8, None, 8, 8, 5, None, False, None),
    ("FACULTY", "ML", "CALENDAR", 180, None, 180, 180, None, None, False, None),
    ("NURSING", "ML", "CALENDAR", 180, None, 180, 180, None, None, False, None),
    ("ADMIN", "ML", "CALENDAR", 180, None, 180, 180, None, None, False, None),
    ("FACULTY", "PL", "CALENDAR", 15, None, 15, 15, None, None, False, None),
    ("NURSING", "PL", "CALENDAR", 15, None, 15, 15, None, None, False, None),
    ("ADMIN", "PL", "CALENDAR", 15, None, 15, 15, None, None, False, None),
    ("FACULTY", "CCL", "CALENDAR", 730, None, 730, 730, None, None, False, None),
    ("NURSING", "CCL", "CALENDAR", 730, None, 730, 730, None, None, False, None),
    ("ADMIN", "CCL", "CALENDAR", 730, None, 730, 730, None, None, False, None),
    ("FACULTY", "COMMUTED", "FINANCIAL", None, None, None, None, None, None, False, None),
    ("NURSING", "COMMUTED", "FINANCIAL", None, None, None, None, None, None, False, None),
    ("ADMIN", "COMMUTED", "FINANCIAL", None, None, None, None, None, None, False, None),
]


def run(session):
    count = 0
    for (cat_code, lt_code, year_ref, dpy, pr, y1, y2,
         max_stretch, max_tenure, cf, special) in CCS_RULES:
        cat_id = _get_category_id(session, cat_code)
        lt_id = _get_leave_type_id(session, lt_code)

        existing = session.execute(
            text("""
                SELECT id FROM leave_entitlement_rules
                WHERE category_id = :cat_id AND leave_type_id = :lt_id
            """),
            {"cat_id": cat_id, "lt_id": lt_id},
        ).fetchone()
        if existing:
            continue

        session.execute(
            text("""
                INSERT INTO leave_entitlement_rules
                    (category_id, leave_type_id, year_ref, days_per_year,
                     prorata_rate, year1_days, year2_plus_days,
                     max_at_a_stretch, max_in_tenure, carry_forward, special_rules)
                VALUES
                    (:cat_id, :lt_id, :year_ref, :dpy,
                     :pr, :y1, :y2,
                     :max_stretch, :max_tenure, :cf, :special::jsonb)
            """),
            {
                "cat_id": cat_id, "lt_id": lt_id,
                "year_ref": year_ref, "dpy": dpy,
                "pr": pr, "y1": y1, "y2": y2,
                "max_stretch": max_stretch, "max_tenure": max_tenure,
                "cf": cf, "special": special,
            },
        )
        count += 1
    print(f"Seeded {count} CCS entitlement rules.")
```

---

### FILE: `backend/seeds/versions/004_resident_entitlement_rules.py`

```python
"""Seed 004 — Resident leave entitlement rules (with VERIFY flag for SR_NA)."""

from sqlalchemy import text


def _get_category_id(session, code):
    return session.execute(
        text("SELECT id FROM employee_categories WHERE code = :code"),
        {"code": code},
    ).fetchone()[0]


def _get_leave_type_id(session, code):
    return session.execute(
        text("SELECT id FROM leave_types WHERE code = :code"),
        {"code": code},
    ).fetchone()[0]


# Format: (category, leave_type, year_ref, days_per_year, prorata_rate,
#          year1_days, year2_plus_days, max_stretch, max_tenure,
#          carry_forward, special_rules)
RESIDENT_RULES = [
    # ── ANNUAL_RES (Annual Leave) ──────────────────────────────────────
    ("JR_ACAD", "ANNUAL_RES", "JOINING_DATE", None, None, 30, 36, None, None,
     '{"exam_extension": true}'),
    ("SR_ACAD", "ANNUAL_RES", "JOINING_DATE", None, None, 24, 30, None, None,
     '{"exam_extension": true}'),
    ("JR_NA", "ANNUAL_RES", "JOINING_DATE", None, 2.5, None, None, None, None,
     '{"contract_term_bound": true, "max_tenure_months": 6}'),
    # ⚠️ SR_NA — VERIFY locally before go-live (pull AIIMS Bibinagar establishment circular)
    ("SR_NA", "ANNUAL_RES", "JOINING_DATE", None, 2.5, None, None, None, None,
     '{"contract_term_bound": true, "max_tenure_months": 6, "VERIFY_LOCALLY": true}'),

    # ── EOL ─────────────────────────────────────────────────────────────
    ("JR_ACAD", "EOL", "TENURE", None, None, None, None, None, 30,
     '{"tenure_extension": true}'),
    ("SR_ACAD", "EOL", "TENURE", None, None, None, None, None, 30,
     '{"tenure_extension": true}'),

    # ── ML (GoI rules — 180 days across tenure) ─────────────────────────
    ("JR_ACAD", "ML", "TENURE", None, None, None, None, None, 180,
     '{"tenure_extension": true}'),
    ("SR_ACAD", "ML", "TENURE", None, None, None, None, None, 180,
     '{"tenure_extension": true}'),
    ("JR_NA", "ML", "TENURE", None, None, None, None, None, 180,
     '{"tenure_extension": true}'),
    ("SR_NA", "ML", "TENURE", None, None, None, None, None, 180,
     '{"tenure_extension": true}'),

    # ── PL (GoI rules — 15 days) ────────────────────────────────────────
    ("JR_ACAD", "PL", "TENURE", None, None, None, None, None, 15, None),
    ("SR_ACAD", "PL", "TENURE", None, None, None, None, None, 15, None),
    ("JR_NA", "PL", "TENURE", None, None, None, None, None, 15, None),
    ("SR_NA", "PL", "TENURE", None, None, None, None, None, 15, None),
]


def run(session):
    count = 0
    for (cat_code, lt_code, year_ref, dpy, pr, y1, y2,
         max_stretch, max_tenure, special) in RESIDENT_RULES:
        cat_id = _get_category_id(session, cat_code)
        lt_id = _get_leave_type_id(session, lt_code)

        existing = session.execute(
            text("""
                SELECT id FROM leave_entitlement_rules
                WHERE category_id = :cat_id AND leave_type_id = :lt_id
            """),
            {"cat_id": cat_id, "lt_id": lt_id},
        ).fetchone()
        if existing:
            continue

        session.execute(
            text("""
                INSERT INTO leave_entitlement_rules
                    (category_id, leave_type_id, year_ref, days_per_year,
                     prorata_rate, year1_days, year2_plus_days,
                     max_at_a_stretch, max_in_tenure, special_rules)
                VALUES
                    (:cat_id, :lt_id, :year_ref, :dpy,
                     :pr, :y1, :y2,
                     :max_stretch, :max_tenure, :special::jsonb)
            """),
            {
                "cat_id": cat_id, "lt_id": lt_id,
                "year_ref": year_ref, "dpy": dpy,
                "pr": pr, "y1": y1, "y2": y2,
                "max_stretch": max_stretch, "max_tenure": max_tenure,
                "special": special,
            },
        )
        count += 1
    print(f"Seeded {count} resident entitlement rules.")
```

---

### FILE: `backend/seeds/versions/005_email_templates.py`

```python
"""Seed 005 — Email templates (8 event codes)."""

from sqlalchemy import text

TEMPLATES = [
    {
        "event_code": "APP_SUBMITTED",
        "subject": "Leave Application Submitted —  app_number ",
        "body": """<p>Dear  employee_name ,</p>
<p>Your leave application <strong> app_number </strong> has been submitted successfully.</p>
<p><strong>Leave Type:</strong>  leave_type <br>
<strong>Dates:</strong>  from_date  to  to_date  ( days  days)<br>
<strong>Status:</strong>  status </p>
<p>You will be notified when your application is reviewed.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "APP_APPROVED",
        "subject": "Leave Application Approved —  app_number ",
        "body": """<p>Dear  employee_name ,</p>
<p>Your leave application <strong> app_number </strong> has been <strong>APPROVED</strong>.</p>
<p><strong>Leave Type:</strong>  leave_type <br>
<strong>Dates:</strong>  from_date  to  to_date  ( days  days)</p>
<p>You may download your leave sanction copy from the HRMS portal.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "APP_REJECTED",
        "subject": "Leave Application Rejected —  app_number ",
        "body": """<p>Dear  employee_name ,</p>
<p>Your leave application <strong> app_number </strong> has been <strong>REJECTED</strong>.</p>
<p><strong>Remarks:</strong>  remarks </p>
<p>Please contact your approving authority for further clarification.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "APP_MODIFIED",
        "subject": "Leave Application Modified —  app_number ",
        "body": """<p>Dear  employee_name ,</p>
<p>Your leave application <strong> app_number </strong> has been <strong>MODIFIED</strong> by the approving authority.</p>
<p><strong>Original Dates:</strong>  original_from  to  original_to <br>
<strong>Modified Dates:</strong>  modified_from  to  modified_to </p>
<p>Please review the changes on the HRMS portal.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "APP_WITHDRAWN",
        "subject": "Leave Application Withdrawn —  app_number ",
        "body": """<p>Dear Sir/Madam,</p>
<p>Leave application <strong> app_number </strong> submitted by <strong> employee_name </strong> has been <strong>WITHDRAWN</strong>.</p>
<p>No further action is required.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "APPROVAL_REQUEST",
        "subject": "Leave Approval Request —  app_number  —  employee_name ",
        "body": """<p>Dear  approver_name ,</p>
<p>A leave application requires your approval.</p>
<p><strong>Application:</strong>  app_number <br>
<strong>Employee:</strong>  employee_name  ( emp_code )<br>
<strong>Leave Type:</strong>  leave_type <br>
<strong>Dates:</strong>  from_date  to  to_date  ( days  days)<br>
<strong>Reason:</strong>  reason </p>
<p>Please log in to the HRMS portal to take action.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "SLA_BREACH",
        "subject": "ACTION REQUIRED — Leave Application  app_number  pending beyond SLA",
        "body": """<p>Dear  approver_name ,</p>
<p>Leave application <strong> app_number </strong> from <strong> employee_name </strong> has been pending your approval for <strong> pending_hours  hours</strong> (SLA:  sla_hours  hours).</p>
<p>Please take immediate action on the HRMS portal.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
    {
        "event_code": "BALANCE_LOW",
        "subject": "Low Leave Balance Alert —  leave_type ",
        "body": """<p>Dear  employee_name ,</p>
<p>Your <strong> leave_type </strong> balance is running low.</p>
<p><strong>Current Balance:</strong>  balance  days</p>
<p>Please plan your leave applications accordingly.</p>
<p>— AIIMS HRMS, Bibinagar</p>""",
    },
]


def run(session):
    count = 0
    for t in TEMPLATES:
        existing = session.execute(
            text("SELECT id FROM email_templates WHERE event_code = :ec"),
            {"ec": t["event_code"]},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO email_templates (event_code, subject_template, body_template)
                VALUES (:ec, :subject, :body)
            """),
            {"ec": t["event_code"], "subject": t["subject"], "body": t["body"]},
        )
        count += 1
    print(f"Seeded {count} email templates.")
```

---

### FILE: `backend/seeds/versions/006_default_workflow_configs.py`

```python
"""Seed 006 — Default workflow configs (baseline chains per category).

Sets up minimal default workflows:
  - Regular staff: HOD → Establishment Officer → Registrar
  - Residents: HOD → Dean Academic
  - Both with Director as final authority.

These are baseline defaults — admin can customize through the Phase 3 UI.
"""

from sqlalchemy import text
import uuid


def _ensure_user(session, username, role):
    """Ensure a placeholder user exists for workflow seed FK references."""
    existing = session.execute(
        text("SELECT id FROM users WHERE username = :username"),
        {"username": username},
    ).fetchone()
    if existing:
        return existing[0]
    uid = str(uuid.uuid4())
    session.execute(
        text("""
            INSERT INTO users (id, username, password_hash, role, is_active)
            VALUES (:id, :username, :ph, :role, true)
        """),
        {"id": uid, "username": username,
         "ph": "$2b$12$PLACEHOLDER_NOT_A_REAL_HASH", "role": role},
    )
    return uid


def run(session):
    admin_id = _ensure_user(session, "workflow_seed_admin", "ADMIN")
    count = 0

    # ── Regular Staff Default (HOD → Establishment → Registrar) ──────────
    reg_configs = [
        ("Regular Staff — Default (All Types, All Durations)", None, None, 1, None),
    ]
    for name, cat_code, lt_code, min_d, max_d in reg_configs:
        existing = session.execute(
            text("SELECT id FROM workflow_configs WHERE config_name = :name"),
            {"name": name},
        ).fetchone()
        if existing:
            continue

        cid = str(uuid.uuid4())
        session.execute(
            text("""
                INSERT INTO workflow_configs
                    (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
                VALUES (:id, :name, NULL, NULL, :min_d, :max_d, :created_by)
            """),
            {"id": cid, "name": name, "min_d": min_d, "max_d": max_d, "created_by": admin_id},
        )

        # Workflow steps
        steps = [
            (1, "HOD", "Department", 48, False),
            (2, "ESTABLISHMENT_OFFICER", "Establishment", 72, False),
            (3, "REGISTRAR", "Registrar Office", 72, True),
        ]
        for step_order, role, office, sla, is_final in steps:
            session.execute(
                text("""
                    INSERT INTO workflow_steps
                        (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
                    VALUES (:config_id, :step_order, :role, :office, :sla, :is_final)
                """),
                {"config_id": cid, "step_order": step_order,
                 "role": role, "office": office, "sla": sla, "is_final": is_final},
            )
        count += 1

    # ── Resident Default (HOD → Dean Academic) ─────────────────────────
    res_configs = [
        ("Resident — Default (All Types, All Durations)", None, None, 1, None),
    ]
    for name, cat_code, lt_code, min_d, max_d in res_configs:
        existing = session.execute(
            text("SELECT id FROM workflow_configs WHERE config_name = :name"),
            {"name": name},
        ).fetchone()
        if existing:
            continue

        cid = str(uuid.uuid4())
        session.execute(
            text("""
                INSERT INTO workflow_configs
                    (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
                VALUES (:id, :name, NULL, NULL, :min_d, :max_d, :created_by)
            """),
            {"id": cid, "name": name, "min_d": min_d, "max_d": max_d, "created_by": admin_id},
        )

        steps = [
            (1, "HOD", "Department", 48, False),
            (2, "DEAN_ACADEMIC", "Dean Academic Office", 72, True),
        ]
        for step_order, role, office, sla, is_final in steps:
            session.execute(
                text("""
                    INSERT INTO workflow_steps
                        (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
                    VALUES (:config_id, :step_order, :role, :office, :sla, :is_final)
                """),
                {"config_id": cid, "step_order": step_order,
                 "role": role, "office": office, "sla": sla, "is_final": is_final},
            )
        count += 1

    print(f"Seeded {count} workflow configs with steps.")
```

---

