"""Reports routes -- leave register, abstract, LOP, pending, balance summary, sanction PDF, payroll export."""

import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/leave-register")
async def leave_register(
    from_date: str = Query(), to_date: str = Query(), department_code: str = Query(None),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "DEAN_ACADEMIC")),
    db: AsyncSession = Depends(get_db),
):
    query = """SELECT e.emp_code, e.name, d.name AS dept, lt.code AS leave_type, a.from_date, a.to_date, a.applied_days, a.status, a.submitted_at FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.from_date <= :t AND a.to_date >= :f"""
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)
    params = {"f": fd, "t": td}
    if department_code:
        query += " AND d.code = :dc"; params["dc"] = department_code
    query += " ORDER BY e.emp_code, a.from_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/leave-abstract")
async def leave_abstract(
    from_date: str = Query(), to_date: str = Query(),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)
    result = await db.execute(text("""
        SELECT d.name AS department, lt.code AS leave_type, COUNT(*) AS count, SUM(a.applied_days) AS total_days
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.status = 'APPROVED' AND a.from_date BETWEEN :f AND :t
        GROUP BY d.name, lt.code ORDER BY d.name, lt.code
    """), {"f": fd, "t": td})
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/pending-applications")
async def pending_report(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT a.app_number, e.name, e.emp_code, lt.code AS leave_type, a.submitted_at,
               EXTRACT(DAY FROM (now() - a.submitted_at)) AS days_pending, a.status
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.status IN ('SUBMITTED','UNDER_REVIEW') ORDER BY a.submitted_at
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/balance-summary")
async def balance_summary(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT e.emp_code, e.name, d.name AS dept, lt.code AS leave_type, lb.opening_balance, lb.credited, lb.availed, lb.closing_balance
        FROM leave_balances lb JOIN employees e ON lb.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.leave_year = 2026 ORDER BY e.emp_code, lt.code
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/sanction-pdf/{application_id}")
async def sanction_pdf(
    application_id: str,
    current_user: dict = Depends(require_role(
        "ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC"
    )),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT a.*, e.name AS emp_name, e.emp_code,
               d.name AS dept_name, des.name AS designation_name,
               lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        JOIN designations des ON e.designation_id = des.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.id = :id
    """), {"id": application_id})
    app = result.fetchone()
    if not app:
        raise HTTPException(status_code=404)
    if app.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED leave can generate sanction copy")

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"],
        fontSize=14, spaceAfter=4, alignment=1,  # centre
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"],
        fontSize=10, spaceAfter=2, alignment=1,
    )
    label_style = ParagraphStyle("Label", parent=styles["Normal"], fontSize=10)

    story = []
    story.append(Paragraph("AIIMS Bibinagar", title_style))
    story.append(Paragraph(
        "All India Institute of Medical Sciences, Bibinagar, Telangana – 508126",
        sub_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("<b>LEAVE SANCTION ORDER</b>", title_style))
    story.append(Spacer(1, 0.4 * cm))

    safe_app_no = str(app.app_number)
    details = [
        ["Application No.", safe_app_no],
        ["Employee Name", f"{app.emp_name} ({app.emp_code})"],
        ["Department", app.dept_name],
        ["Designation", app.designation_name],
        ["Leave Type", f"{app.leave_type_name} ({app.leave_type_code})"],
        ["From Date", str(app.from_date)],
        ["To Date", str(app.to_date)],
        ["Applied Days", str(app.applied_days)],
        ["Status", "APPROVED"],
        ["Approving Authority", current_user.get("username", "—")],
        ["Date of Issue", str(date.today())],
    ]
    tbl = Table(details, colWidths=[5 * cm, 11 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f0fe")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "This is a system-generated document and does not require a physical signature.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
    ))

    doc.build(story)
    pdf_bytes = buf.getvalue()

    safe_filename = f"sanction_{safe_app_no.replace('/', '-')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"},
    )


@router.get("/leave-calendar")
async def leave_calendar(
    department_code: str = Query(None), month: str = Query(None),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = """SELECT e.emp_code, e.name, a.from_date, a.to_date, lt.code AS leave_type FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.status = 'APPROVED'"""
    params = {}
    if department_code:
        query += " AND d.code = :dc"; params["dc"] = department_code
    if month:
        query += " AND a.from_date >= :ms AND a.from_date < :me"
        m = date.fromisoformat(month + "-01")
        params["ms"] = m; params["me"] = date(m.year, m.month + 1, 1) if m.month < 12 else date(m.year + 1, 1, 1)
    query += " ORDER BY a.from_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/payroll-export")
async def payroll_export(
    from_date: str = Query(), to_date: str = Query(), export_type: str = Query("LOP"),
    current_user: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)
    result = await db.execute(text("""
        SELECT e.emp_code, e.name, d.name AS department, EXTRACT(MONTH FROM a.from_date) AS month_num, SUM(a.applied_days) AS lop_days, a.status
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.from_date BETWEEN :f AND :t AND a.status = 'APPROVED' AND lt.code = 'EOL'
        GROUP BY e.emp_code, e.name, d.name, EXTRACT(MONTH FROM a.from_date), a.status
        ORDER BY e.emp_code
    """), {"f": fd, "t": td})
    rows = [dict(r._mapping) for r in result.fetchall()]

    # Log to payroll_export_log
    await db.execute(text("INSERT INTO payroll_export_log (id, export_from, export_to, export_type, exported_by, record_count) VALUES (uuid_generate_v4(), :f, :t, :et, :by, :rc)"), {"f": fd, "t": td, "et": export_type, "by": current_user["user_id"], "rc": len(rows)})
    await db.commit()

    # Generate CSV
    csv_buf = io.StringIO()
    csv_buf.write("Emp Code,Name,Department,Month,LOP Days,Status\n")
    for r in rows:
        csv_buf.write(f"{r['emp_code']},{r['name']},{r['department']},{int(r['month_num'])},{r['lop_days']},{r['status']}\n")
    csv_buf.seek(0)
    return StreamingResponse(iter([csv_buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=payroll_export_{from_date}_{to_date}.csv"})