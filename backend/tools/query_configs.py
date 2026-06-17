import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        print("config_name | category_id | leave_type_id | is_active")
        print("-" * 80)
        configs = conn.execute(text("SELECT config_name, category_id, leave_type_id, is_active FROM workflow_configs ORDER BY config_name")).fetchall()
        for c in configs:
            print(f"{c.config_name} | {c.category_id} | {c.leave_type_id} | {c.is_active}")

if __name__ == "__main__":
    main()
