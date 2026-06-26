"""All SQLAlchemy models â€” import everything so Alembic can detect them."""

from app.models.base import Base
from app.models.identity import User, TokenBlacklist
from app.models.employee import EmployeeCategory, Department, DeptNodalAssignment, Designation, Employee
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
    "DeptNodalAssignment",
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