"""0001_initial_schema

Creates all 21 tables for AIIMS HRMS (Groups 1-8):
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
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 2 â€” Employee Master (FK-free tables first)
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        sa.Column("name", sa.String(150), unique=True, nullable=False),
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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 1 â€” Identity & Auth (users depends on employees)
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), unique=True, nullable=True),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("must_change_password", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("tokens_valid_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 3 â€” Leave Configuration
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 4 â€” Leave Transactions
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        sa.Column("closing_balance", sa.Numeric(6, 2), sa.Computed("opening_balance + credited - availed", persisted=True)),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("employee_id", "leave_type_id", "leave_year"),
    )

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
        sa.UniqueConstraint("config_name", "version"),
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
        "leave_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("app_number", sa.String(30), unique=True, nullable=False),
        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_configs.id"), nullable=False),
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

    # Overlap exclusion constraint (requires btree_gist)
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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 5 â€” Workflow Engine
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 6 â€” Notifications & Communication
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 7 â€” Audit & Export
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
            RAISE EXCEPTION 'audit_log is append-only -- UPDATE and DELETE are not permitted';
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_log_no_update
        BEFORE UPDATE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutation()
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_log_no_delete
        BEFORE DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutation()
    """)

    # Yearly partitions for audit_log (2026, 2027)
    for year in [2026, 2027]:
        op.execute(f"""
            CREATE TABLE audit_log_{year} (
                LIKE audit_log INCLUDING DEFAULTS INCLUDING CONSTRAINTS
            )
        """)
        op.execute(f"ALTER TABLE audit_log_{year} INHERIT audit_log")

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

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # Group 8 â€” Payroll Foundation (Reserved, v1.1/v2)
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    op.drop_table("employee_salary_assignments")
    op.drop_table("salary_structures")
    op.drop_table("attendance_raw")
    op.drop_table("payroll_export_log")

    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS audit_log_no_mutation()")
    for year in [2026, 2027]:
        op.execute(f"DROP TABLE IF EXISTS audit_log_{year}")
    op.drop_table("audit_log")

    op.drop_table("email_templates")
    op.drop_table("notification_queue")
    op.drop_table("leave_approvals")
    op.execute("ALTER TABLE leave_applications DROP CONSTRAINT IF EXISTS no_overlapping_approved_leave")
    op.drop_table("leave_documents")
    op.drop_table("leave_applications")
    op.drop_table("workflow_steps")
    op.drop_table("workflow_configs")
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
