"""Workflow config resolution — single source of truth for matching rules.

Most-specific wins: category → leave type → day range (highest min_days).
Used by leave apply, simulate, and masters list helpers.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Shared ORDER BY — keep simulate and leave apply identical.
_WORKFLOW_MATCH_ORDER = """
    (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    wc.min_days DESC,
    wc.config_name ASC
"""

_WORKFLOW_MATCH_WHERE = """
    wc.is_active = true
    AND (wc.category_id IS NULL OR c.code = :cat)
    AND (wc.leave_type_id IS NULL OR lt.code = :lt)
    AND wc.min_days <= :days
    AND (wc.max_days IS NULL OR wc.max_days >= :days)
"""


def normalize_code(value: str | None) -> str | None:
    """Trim and uppercase lookup codes; blank → None (wildcard)."""
    if value is None:
        return None
    cleaned = str(value).strip().upper()
    return cleaned or None


def days_in_workflow_range(applied_days: float, min_days: int | None, max_days: int | None) -> bool:
    """Pure helper for tests — mirrors SQL day-range filter."""
    effective_min = int(min_days) if min_days is not None else 1
    if applied_days < effective_min:
        return False
    if max_days is not None and applied_days > float(max_days):
        return False
    return True


def workflow_specificity_key(
    *,
    category_specific: bool,
    leave_type_specific: bool,
    min_days: int,
    config_name: str,
) -> tuple[int, int, int, str]:
    """Sort key: higher = more specific. Tie-break by config_name for determinism."""
    return (
        1 if category_specific else 0,
        1 if leave_type_specific else 0,
        int(min_days),
        config_name,
    )


def pick_best_workflow_config(
    candidates: list[dict],
    *,
    category_code: str | None,
    leave_type_code: str | None,
    days: float,
) -> dict | None:
    """Pick best config from in-memory rows (category_code / leave_type_code may be null)."""
    best: dict | None = None
    best_key: tuple[int, int, int, str] | None = None

    for cfg in candidates:
        if not cfg.get("is_active", True):
            continue

        cfg_cat = cfg.get("category_code")
        cfg_lt = cfg.get("leave_type_code")
        has_category = cfg.get("category_id") is not None
        has_leave_type = cfg.get("leave_type_id") is not None

        category_ok = not has_category or (category_code and cfg_cat == category_code)
        leave_type_ok = not has_leave_type or (leave_type_code and cfg_lt == leave_type_code)
        if not category_ok or not leave_type_ok:
            continue

        if not days_in_workflow_range(days, cfg.get("min_days"), cfg.get("max_days")):
            continue

        key = workflow_specificity_key(
            category_specific=has_category,
            leave_type_specific=has_leave_type,
            min_days=int(cfg.get("min_days") or 1),
            config_name=str(cfg.get("config_name") or ""),
        )
        if best_key is None or key > best_key:
            best_key = key
            best = cfg

    return best


async def resolve_workflow_config_id(
    db: AsyncSession,
    category_code: str | None,
    leave_type_code: str | None,
    days: float = 1,
) -> str | None:
    """Return matching workflow_configs.id or None."""
    cat = normalize_code(category_code)
    lt = normalize_code(leave_type_code)
    effective_days = max(float(days), 0.5)

    result = await db.execute(
        text(f"""
            SELECT wc.id FROM workflow_configs wc
            LEFT JOIN employee_categories c ON wc.category_id = c.id
            LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
            WHERE {_WORKFLOW_MATCH_WHERE}
            ORDER BY {_WORKFLOW_MATCH_ORDER}
            LIMIT 1
        """),
        {"cat": cat, "lt": lt, "days": effective_days},
    )
    row = result.fetchone()
    return str(row.id) if row else None


async def resolve_workflow_config(
    db: AsyncSession,
    category_code: str | None,
    leave_type_code: str | None,
    days: float = 1,
) -> dict | None:
    """Return full config row with steps, or None."""
    cat = normalize_code(category_code)
    lt = normalize_code(leave_type_code)
    effective_days = max(float(days), 0.5)

    result = await db.execute(
        text(f"""
            SELECT wc.*, c.code AS category_code, lt.code AS leave_type_code
            FROM workflow_configs wc
            LEFT JOIN employee_categories c ON wc.category_id = c.id
            LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
            WHERE {_WORKFLOW_MATCH_WHERE}
            ORDER BY {_WORKFLOW_MATCH_ORDER}
            LIMIT 1
        """),
        {"cat": cat, "lt": lt, "days": effective_days},
    )
    row = result.fetchone()
    if not row:
        return None

    cfg = dict(row._mapping)
    steps = await db.execute(
        text("SELECT * FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
        {"cid": cfg["id"]},
    )
    cfg["steps"] = [dict(s._mapping) for s in steps.fetchall()]
    return cfg


async def list_workflow_configs_with_steps(db: AsyncSession) -> list[dict]:
    """Load all configs + steps in two queries (avoids N+1)."""
    result = await db.execute(
        text("""
            SELECT wc.*, c.code AS category_code, lt.code AS leave_type_code
            FROM workflow_configs wc
            LEFT JOIN employee_categories c ON wc.category_id = c.id
            LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
            ORDER BY wc.is_active DESC, wc.config_name
        """)
    )
    configs = [dict(r._mapping) for r in result.fetchall()]
    if not configs:
        return []

    config_ids = [c["id"] for c in configs]
    steps_result = await db.execute(
        text("""
            SELECT * FROM workflow_steps
            WHERE config_id = ANY(CAST(:ids AS uuid[]))
            ORDER BY config_id, step_order
        """),
        {"ids": config_ids},
    )
    steps_by_config: dict[str, list[dict]] = {str(c["id"]): [] for c in configs}
    for step in steps_result.fetchall():
        sid = str(step._mapping["config_id"])
        steps_by_config.setdefault(sid, []).append(dict(step._mapping))

    for cfg in configs:
        cfg["steps"] = steps_by_config.get(str(cfg["id"]), [])

    return configs


def no_match_message(category_code: str | None, leave_type_code: str | None, days: float) -> str:
    cat_label = category_code or "any category"
    lt_label = leave_type_code or "any leave type"
    return (
        f"No active workflow covers {cat_label} + {lt_label} for {days:g} day(s). "
        "Check category, leave type, and min/max day ranges on your workflow configs."
    )


def simulation_requires_both_message() -> str:
    return (
        "Select both employee category and leave type. "
        "Simulation mirrors a real leave application for that staff group."
    )


def entitlement_blocked_message(category_code: str, leave_type_code: str) -> str:
    return (
        f"{leave_type_code} is not configured for {category_code} staff in Entitlements. "
        "That combination cannot be submitted as leave, so no approval route applies."
    )
