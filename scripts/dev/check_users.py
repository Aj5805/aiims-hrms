from sqlalchemy import create_engine, text
engine = create_engine('postgresql+psycopg2://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms')
with engine.connect() as conn:
    rows = conn.execute(text("SELECT username, role, is_active, must_change_password FROM users ORDER BY username")).fetchall()
    for r in rows:
        print(f"  username={r[0]!r:30s} role={r[1]!r:25s} is_active={r[2]} must_change_password={r[3]}")
