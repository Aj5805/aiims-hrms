import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        configs = conn.execute(text("SELECT id, config_name, category_id FROM workflow_configs")).fetchall()
        for c in configs:
            steps = conn.execute(text("SELECT step_order, approver_role FROM workflow_steps WHERE config_id = :cid"), {"cid": c.id}).fetchall()
            print(f"Config: {c.config_name} | {c.id} | Cat: {c.category_id} | Steps: {steps}")

if __name__ == "__main__":
    main()
