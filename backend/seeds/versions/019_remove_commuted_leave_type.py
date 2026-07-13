"""Seed 019 — Remove COMMUTED leave type; HPL commutation is an application flag."""

from sqlalchemy import text


def run(session):
    session.execute(text("""
        DELETE FROM leave_documents ld
        USING leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE ld.application_id = a.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("""
        DELETE FROM leave_approvals la
        USING leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE la.application_id = a.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("""
        DELETE FROM leave_balance_ledger lbl
        USING leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lbl.balance_id = lb.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("""
        DELETE FROM leave_applications a
        USING leave_types lt
        WHERE a.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("""
        DELETE FROM leave_balances lb
        USING leave_types lt
        WHERE lb.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("""
        DELETE FROM leave_entitlement_rules ler
        USING leave_types lt
        WHERE ler.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """))
    session.execute(text("DELETE FROM leave_types WHERE code = 'COMMUTED'"))
    session.execute(text("""
        UPDATE leave_types
        SET validation_rules = jsonb_set(
            COALESCE(validation_rules, '{}'::jsonb),
            '{incompatible_types}',
            '["EL", "HPL", "EOL"]'::jsonb,
            true
        )
        WHERE code = 'CL'
    """))
    print("Removed COMMUTED leave type; commutation is now an HPL application option.")
