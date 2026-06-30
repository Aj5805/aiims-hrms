"""Leave application form templates (AIIMS Bibinagar proformas)."""

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.data.leave_form_templates import filter_form_templates

router = APIRouter(prefix="/leave-form-templates", tags=["leave-form-templates"])


@router.get("")
async def list_form_templates(
    category_code: str | None = Query(None),
    leave_type_code: str | None = Query(None),
    purpose: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Return institutional leave form links filtered by category, leave type, or purpose."""
    templates = filter_form_templates(
        category_code=category_code,
        leave_type_code=leave_type_code,
        purpose=purpose,
    )
    return {
        "source_page": "https://aiimsbibinagar.edu.in/forms.html",
        "templates": templates,
    }
