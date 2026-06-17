import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        apps = conn.execute(text("SELECT id, config_id, current_step_order FROM leave_applications")).fetchall()
        print("Leave Apps:", apps)
        for app in apps:
            steps = conn.execute(text("SELECT step_order, approver_role FROM workflow_steps WHERE config_id = :cid"), {"cid": app.config_id}).fetchall()
            print("Steps for", app.config_id, ":", steps)

if __name__ == "__main__":
    main()
