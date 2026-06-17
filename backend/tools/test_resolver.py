import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    categories = ['JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA', 'FACULTY', 'NURSING', 'ADMIN']
    
    with engine.connect() as conn:
        print(f"{'Category':<15} | Resolved Config")
        print("-" * 60)
        for cat in categories:
            query = """
                SELECT wc.config_name FROM workflow_configs wc
                LEFT JOIN employee_categories c ON wc.category_id = c.id
                LEFT JOIN leave_types wlt ON wc.leave_type_id = wlt.id
                WHERE wc.is_active = true
                  AND (wc.category_id IS NULL OR c.code = :cat)
                  AND (wc.leave_type_id IS NULL OR wlt.code = 'CL')
                ORDER BY (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                         (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC
                LIMIT 1
            """
            result = conn.execute(text(query), {"cat": cat}).fetchone()
            resolved = result[0] if result else "None"
            print(f"{cat:<15} | {resolved}")

if __name__ == "__main__":
    main()
