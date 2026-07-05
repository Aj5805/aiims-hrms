"""Seed 016 — Simplify workflows to HOD → Nodal Officer (category-routed)."""

from sqlalchemy import text


def _update_steps(session, config_name: str, steps: list[tuple]):
    row = session.execute(
        text("SELECT id FROM workflow_configs WHERE config_name = :name"),
        {"name": config_name},
    ).fetchone()
    if not row:
        return
    cid = row[0]
    existing = session.execute(
        text("SELECT id, step_order FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
        {"cid": cid},
    ).fetchall()

    for idx, (step_order, role, office, sla, is_final) in enumerate(steps):
        if idx < len(existing):
            session.execute(
                text("""
                    UPDATE workflow_steps
                    SET step_order = :step_order, approver_role = :role, approver_office = :office,
                        sla_hours = :sla, is_final_authority = :is_final
                    WHERE id = :id
                """),
                {
                    "id": existing[idx][0],
                    "step_order": step_order,
                    "role": role,
                    "office": office,
                    "sla": sla,
                    "is_final": is_final,
                },
            )
        else:
            session.execute(
                text("""
                    INSERT INTO workflow_steps
                        (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
                    VALUES (:config_id, :step_order, :role, :office, :sla, :is_final)
                """),
                {
                    "config_id": cid,
                    "step_order": step_order,
                    "role": role,
                    "office": office,
                    "sla": sla,
                    "is_final": is_final,
                },
            )

    max_step_order = max(s[0] for s in steps)
    session.execute(
        text("""
            UPDATE workflow_steps
            SET is_final_authority = (step_order = :final_so)
            WHERE config_id = :cid
        """),
        {"cid": cid, "final_so": max_step_order},
    )

    # Remove extra steps only when not referenced by leave_approvals (keeps historical rows intact).
    extras = session.execute(
        text("SELECT id FROM workflow_steps WHERE config_id = :cid AND step_order > :max_so ORDER BY step_order"),
        {"cid": cid, "max_so": max_step_order},
    ).fetchall()
    for (step_id,) in extras:
        refs = session.execute(
            text("SELECT 1 FROM leave_approvals WHERE step_id = :sid LIMIT 1"),
            {"sid": step_id},
        ).fetchone()
        if not refs:
            session.execute(text("DELETE FROM workflow_steps WHERE id = :id"), {"id": step_id})

    if len(existing) > len(steps):
        for extra in existing[len(steps):]:
            refs = session.execute(
                text("SELECT 1 FROM leave_approvals WHERE step_id = :sid LIMIT 1"),
                {"sid": extra[0]},
            ).fetchone()
            if not refs:
                session.execute(text("DELETE FROM workflow_steps WHERE id = :id"), {"id": extra[0]})


def run(session):
    regular_steps = [
        (1, "HOD", "Department", 48, False),
        (2, "NODAL_OFFICER", "Establishment", 72, True),
    ]
    resident_steps = [
        (1, "HOD", "Department", 48, False),
        (2, "NODAL_OFFICER", "Registrar Office", 72, True),
    ]

    for name in (
        "Regular Staff — Default (All Types, All Duration)",
        "Regular Staff — Default (All Types, All Durations)",
    ):
        _update_steps(session, name, regular_steps)

    residency_categories = session.execute(
        text("SELECT code FROM employee_categories WHERE leave_scheme = 'RESIDENCY'")
    ).fetchall()
    for cat in residency_categories:
        _update_steps(session, f"Resident — Default ({cat.code})", resident_steps)

    print("Updated workflow configs to HOD -> Nodal Officer routing.")
