"""Seed 005 — Email templates (8 event codes)."""

from sqlalchemy import text

TEMPLATES = [
    {
        "event_code": "APP_SUBMITTED",
        "subject": "Leave Application Submitted — {{app_number}}",
        "body": "<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been submitted successfully.</p><p><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)<br><strong>Status:</strong> {{status}}</p><p>You will be notified when your application is reviewed.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "APP_APPROVED",
        "subject": "Leave Application Approved — {{app_number}}",
        "body": "<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>APPROVED</strong>.</p><p><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)</p><p>You may download your leave sanction copy from the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "APP_REJECTED",
        "subject": "Leave Application Rejected — {{app_number}}",
        "body": "<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>REJECTED</strong>.</p><p><strong>Remarks:</strong> {{remarks}}</p><p>Please contact your approving authority for further clarification.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "APP_MODIFIED",
        "subject": "Leave Application Modified — {{app_number}}",
        "body": "<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>MODIFIED</strong> by the approving authority.</p><p><strong>Original Dates:</strong> {{original_from}} to {{original_to}}<br><strong>Modified Dates:</strong> {{modified_from}} to {{modified_to}}</p><p>Please review the changes on the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "APP_WITHDRAWN",
        "subject": "Leave Application Withdrawn — {{app_number}}",
        "body": "<p>Dear Sir/Madam,</p><p>Leave application <strong>{{app_number}}</strong> submitted by <strong>{{employee_name}}</strong> has been <strong>WITHDRAWN</strong>.</p><p>No further action is required.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "APPROVAL_REQUEST",
        "subject": "Leave Approval Request — {{app_number}} — {{employee_name}}",
        "body": "<p>Dear {{approver_name}},</p><p>A leave application requires your approval.</p><p><strong>Application:</strong> {{app_number}}<br><strong>Employee:</strong> {{employee_name}} ({{emp_code}})<br><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)<br><strong>Reason:</strong> {{reason}}</p><p>Please log in to the HRMS portal to take action.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "SLA_BREACH",
        "subject": "ACTION REQUIRED — Leave Application {{app_number}} pending beyond SLA",
        "body": "<p>Dear {{approver_name}},</p><p>Leave application <strong>{{app_number}}</strong> from <strong>{{employee_name}}</strong> has been pending your approval for <strong>{{pending_hours}} hours</strong> (SLA: {{sla_hours}} hours).</p><p>Please take immediate action on the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>",
    },
    {
        "event_code": "BALANCE_LOW",
        "subject": "Low Leave Balance Alert — {{leave_type}}",
        "body": "<p>Dear {{employee_name}},</p><p>Your <strong>{{leave_type}}</strong> balance is running low.</p><p><strong>Current Balance:</strong> {{balance}} days</p><p>Please plan your leave applications accordingly.</p><p>— AIIMS HRMS, Bibinagar</p>",
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