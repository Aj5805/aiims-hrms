import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

async def main():
    engine = create_async_engine("postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms")
    try:
        async with engine.begin() as conn:
            res = await conn.execute(text("SELECT id, config_name, leave_type_id, category_id FROM workflow_configs"))
            print("id | config_name | leave_type_id | category_id")
            for r in res:
                print(r)
    except Exception as e:
        print("Error connecting:", e)

if __name__ == "__main__":
    asyncio.run(main())
