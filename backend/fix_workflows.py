import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import uuid
import os

DATABASE_URL = "postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms"

async def fix():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # 1. Delete existing
        await conn.execute(text("DELETE FROM leave_approvals"))
        await conn.execute(text("DELETE FROM leave_applications")) # Since apps reference configs
        await conn.execute(text("DELETE FROM workflow_steps"))
        await conn.execute(text("DELETE FROM workflow_configs"))
        
        # 2. Find admin user
        res = await conn.execute(text("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1"))
        admin_id = res.fetchone()[0]
        
        # 3. Create universal config
        cid = str(uuid.uuid4())
        await conn.execute(text("""
            INSERT INTO workflow_configs
                (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
            VALUES (:id, 'Default Approval Chain (Universal)', NULL, NULL, 1, NULL, :cby)
        """), {"id": cid, "cby": admin_id})
        
        # 4. Add Step 1 (HOD)
        await conn.execute(text("""
            INSERT INTO workflow_steps
                (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
            VALUES (:cid, 1, 'HOD', 'Department', 48, false)
        """), {"cid": cid})
        
        # 5. Add Step 2 (NODAL_OFFICER)
        await conn.execute(text("""
            INSERT INTO workflow_steps
                (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
            VALUES (:cid, 2, 'NODAL_OFFICER', 'Nodal Office', 72, true)
        """), {"cid": cid})

        print("Successfully wiped and re-seeded universal workflow chain.")

asyncio.run(fix())
