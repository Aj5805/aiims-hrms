"""Seed 005 — Email templates (8 event codes)."""

from sqlalchemy import text

TEMPLATES = [
    {
        "event_code": "APP_SUBMITTED",
        "subject": "Leave submitted — {{app_number}}",
        "body": "{{leave_type}} {{from_date}}–{{to_date}} ({{days}}d) submitted. Awaiting approval.",
    },
    {
        "event_code": "APP_APPROVED",
        "subject": "Leave approved — {{app_number}}",
        "body": "{{leave_type}} {{from_date}}–{{to_date}} ({{days}}d) approved.",
    },
    {
        "event_code": "APP_REJECTED",
        "subject": "Leave rejected — {{app_number}}",
        "body": "{{leave_type}} {{from_date}}–{{to_date}} rejected.{% if remarks %} Remarks: {{remarks}}.{% endif %}",
    },
    {
        "event_code": "APP_MODIFIED",
        "subject": "Leave dates changed — {{app_number}}",
        "body": "Dates updated to {{modified_from}}–{{modified_to}} (was {{original_from}}–{{original_to}}).",
    },
    {
        "event_code": "APP_WITHDRAWN",
        "subject": "Leave withdrawn — {{app_number}}",
        "body": "{{employee_name}} withdrew {{app_number}}.",
    },
    {
        "event_code": "APPROVAL_REQUEST",
        "subject": "Approval needed — {{app_number}}",
        "body": "{{employee_name}} ({{emp_code}}): {{leave_type}} {{from_date}}–{{to_date}} ({{days}}d).",
    },
    {
        "event_code": "SLA_BREACH",
        "subject": "SLA overdue — {{app_number}}",
        "body": "{{app_number}} pending {{pending_hours}}h (SLA {{sla_hours}}h). Action needed.",
    },
    {
        "event_code": "BALANCE_LOW",
        "subject": "Low {{leave_type}} balance",
        "body": "{{leave_type}} balance is {{balance}} days.",
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
            # Update subject/body in case they contain the old corrupted encoding
            session.execute(
                text("""
                    UPDATE email_templates
                    SET subject_template = :subject, body_template = :body
                    WHERE event_code = :ec
                """),
                {"ec": t["event_code"], "subject": t["subject"], "body": t["body"]},
            )
        else:
            session.execute(
                text("""
                    INSERT INTO email_templates (event_code, subject_template, body_template)
                    VALUES (:ec, :subject, :body)
                """),
                {"ec": t["event_code"], "subject": t["subject"], "body": t["body"]},
            )
            count += 1
    print(f"Seeded/updated email templates ({count} new).")