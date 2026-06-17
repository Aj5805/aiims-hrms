from sqlalchemy import create_engine, text
engine = create_engine('postgresql+psycopg2://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms')
with engine.connect() as conn:
    rows = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).fetchall()
    print('Tables:', [r[0] for r in rows])
    print('Count:', len(rows))
