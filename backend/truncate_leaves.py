from sqlalchemy import create_engine, text
from app.core.config import settings

def truncate_leaves():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        print("Truncating leave_types and cascading...")
        # This will wipe leave_types, leave_entitlement_rules, leave_balances, leave_applications
        conn.execute(text("TRUNCATE TABLE leave_types CASCADE;"))
        conn.commit()
        print("Truncation complete.")

if __name__ == "__main__":
    truncate_leaves()
