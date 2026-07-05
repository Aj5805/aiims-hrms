"""Leave policy overhaul — tenure pools, gender rules, half-yearly EL/HPL.

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
"""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "m3n4o5p6q7r8"
down_revision: Union[str, None] = "l2m3n4o5p6q7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CCS_TENURE = [
    ("ML", 180, 2, "FEMALE_ONLY"),
    ("PL", 15, 2, "MALE_ONLY"),
    ("CCL", 730, None, "FEMALE_ONLY"),
]


def upgrade():
    op.execute("""
        UPDATE leave_types
        SET requires_mc = false, min_days_for_mc = NULL
        WHERE code IN ('HPL', 'ML', 'PL', 'COMMUTED')
    """)

    for lt_code, max_tenure, max_times, gender in _CCS_TENURE:
        special = {"gender_eligibility": gender}
        if max_times is not None:
            special["max_times_in_service"] = max_times
        special_json = json.dumps(special).replace("'", "''")
        op.execute(f"""
            UPDATE leave_entitlement_rules ler
            SET year_ref = 'TENURE',
                days_per_year = NULL,
                prorata_rate = NULL,
                credit_frequency = 'ANNUAL',
                max_in_tenure = {max_tenure},
                special_rules = '{special_json}'::jsonb
            FROM employee_categories c, leave_types lt
            WHERE ler.category_id = c.id
              AND ler.leave_type_id = lt.id
              AND c.code IN ('FACULTY', 'NURSING', 'ADMIN')
              AND lt.code = '{lt_code}'
        """)

    for lt_code in ("EL", "HPL"):
        op.execute(f"""
            UPDATE leave_entitlement_rules ler
            SET credit_frequency = 'HALF_YEARLY', year_ref = 'CALENDAR'
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id AND lt.code = '{lt_code}'
        """)

    op.execute("""
        UPDATE leave_entitlement_rules ler
        SET special_rules = '{"gender_eligibility": "FEMALE_ONLY", "max_times_in_service": 2, "tenure_extension": true}'::jsonb
        FROM leave_types lt
        WHERE ler.leave_type_id = lt.id AND lt.code = 'ML'
          AND ler.year_ref = 'TENURE'
    """)
    op.execute("""
        UPDATE leave_entitlement_rules ler
        SET special_rules = '{"gender_eligibility": "MALE_ONLY", "max_times_in_service": 2}'::jsonb
        FROM leave_types lt
        WHERE ler.leave_type_id = lt.id AND lt.code = 'PL'
          AND ler.year_ref = 'TENURE'
    """)


def downgrade():
    pass
