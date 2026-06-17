import sys
import os
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT t.relname AS table_name, c.conname AS constraint_name, c.contype
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.contype IN ('u', 'p', 'f')
            ORDER BY t.relname, c.contype, c.conname;
        """))
        for row in result:
            print(f"Table: {row.table_name:25} | Type: {row.contype} | Constraint: {row.constraint_name}")

if __name__ == "__main__":
    main()
