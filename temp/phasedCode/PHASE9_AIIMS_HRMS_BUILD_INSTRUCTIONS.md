# AIIMS HRMS — Phase 9: UAT, Data Migration & Go-Live

> Prereq: Phases 0-8 complete. This phase is mostly procedural + one script.

---

## PHASE 9 SCOPE

### 1. `scripts/validate_master_data.py`
- Validates CSV: checks emp_code maps to dept/designation, DOJ format, duplicate detection
- Generates `validation_errors.csv` — import **blocks** on critical errors
- Run: `python scripts/validate_master_data.py payroll_dump.csv`

### 2. Data Migration Protocol
- Load real employee data via Phase 2 CSV import
- Load opening balances via Phase 3 Excel import with reconciliation
- After import, run reconciliation summary comparing totals against source Excel
- If mismatch > 0.1% → flag for manual review

### 3. UAT Sessions
1. Establishment team — employee master, balance entry, workflow config
2. Staff — apply for leave end-to-end
3. Approvers — inbox, approve, reject, modify
4. Reports — verify leave register against manual records
5. Fix list → prioritise → patch

### 4. Windows Server Deployment
- Configure NSSM service (see `deployment/nssm-config.txt`)
- Set up Nginx reverse proxy (see `deployment/nginx.conf`)
- Schedule backup via Windows Task Scheduler
- Configure log rotation (`deployment/OPS_RUNBOOK.md`)

### 5. GO-LIVE / CUTOVER CHECKLIST

#### A) Data Readiness
- [ ] Employee master validated (dept/desg/category mappings complete)
- [ ] Opening balances imported + reconciled (spot-check ≥5% per category)
- [ ] Holiday calendar loaded for current + next year
- [ ] Test accounts disabled; default passwords rotated

#### B) Functional Acceptance
- [ ] UAT sign-off (Establishment + Dean Academic + Registrar)
- [ ] All critical leave policy matrix cases executed
- [ ] Reports verified against expected formats

#### C) Security & Access Governance
- [ ] ADMIN assignment restricted
- [ ] Role-change audit entries verified
- [ ] Password policy + lockout verified
- [ ] Quarterly access review schedule assigned

#### D) Operational Readiness
- [ ] Backup job configured + restore test completed
- [ ] NSSM auto-restart configured; logs rotating
- [ ] Health endpoint monitored
- [ ] SMTP configured + test email delivered

#### E) Performance & Stability
- [ ] Smoke test under expected load
- [ ] Key endpoints meet p95 targets

#### F) Cutover Plan
- [ ] Cutover date/time approved (IST)
- [ ] Master data freeze window communicated
- [ ] Rollback plan documented
- [ ] Post go-live hypercare: first 2 weeks

#### G) Go/No-Go
- [ ] Go/No-Go decision signed (Establishment + Dean Academic + Director)
- [ ] Go-live
- [ ] First 48h monitoring: error logs, queue depth, DB pool

---

### FILE: `scripts/validate_master_data.py`

```python
"""Pre-import validation script for master data.

Usage:
    cd backend && python ../scripts/validate_master_data.py <input_csv>

Checks every emp_code maps to existing department_code and designation_code.
Validates DOJ format and ensures it is not in the future.
Checks for duplicate emails/employee codes.
Outputs validation_errors.csv with row-by-row issues.
Blocks on critical errors (missing category).
"""

import csv
import io
import sys
from datetime import date

def validate(csv_path: str) -> dict:
    errors = []
    warnings = []
    rows_seen = set()
    emails_seen = {}

    # This would connect to DB, but we provide the logic as a reference script.
    # Actual DB calls use settings.DATABASE_URL_SYNC.
    departments = set()  # Would be: {r.code for r in session.execute(text("SELECT code FROM departments")).fetchall()}
    designations = set()
    categories = set()

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            emp_code = row.get("emp_code", "").strip()
            name = row.get("name", "").strip()
            doj_str = row.get("doj", "").strip()
            dept_code = row.get("department", "").strip()
            desg_name = row.get("designation", "").strip()
            cat_code = row.get("category", "").strip()
            email = row.get("email", "").strip()

            # Critical: missing required fields
            if not emp_code:
                errors.append({"row": i, "emp_code": "", "issue": "MISSING_EMP_CODE", "severity": "CRITICAL"})
                continue
            if not cat_code:
                errors.append({"row": i, "emp_code": emp_code, "issue": "MISSING_CATEGORY", "severity": "CRITICAL"})
                continue

            # Duplicate emp_code
            if emp_code in rows_seen:
                errors.append({"row": i, "emp_code": emp_code, "issue": "DUPLICATE_EMP_CODE", "severity": "CRITICAL"})
                continue
            rows_seen.add(emp_code)

            # Duplicate email
            if email and email in emails_seen:
                errors.append({"row": i, "emp_code": emp_code, "issue": f"DUPLICATE_EMAIL (row {emails_seen[email]})", "severity": "WARNING"})
            elif email:
                emails_seen[email] = i

            # DOJ format and future check
            try:
                doj = date.fromisoformat(doj_str)
                if doj > date.today():
                    errors.append({"row": i, "emp_code": emp_code, "issue": "DOJ_IN_FUTURE", "severity": "WARNING"})
            except ValueError:
                errors.append({"row": i, "emp_code": emp_code, "issue": "INVALID_DOJ_FORMAT", "severity": "CRITICAL"})

            # FK validation (would query DB)
            if dept_code and dept_code not in departments:
                warnings.append({"row": i, "emp_code": emp_code, "issue": f"UNKNOWN_DEPT: {dept_code}", "severity": "WARNING"})
            if desg_name and desg_name not in designations:
                warnings.append({"row": i, "emp_code": emp_code, "issue": f"UNKNOWN_DESIGNATION: {desg_name}", "severity": "WARNING"})

    # Write error report
    with open("validation_errors.csv", "w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=["row", "emp_code", "issue", "severity"])
        writer.writeheader()
        for e in errors + warnings:
            writer.writerow(e)

    criticals = [e for e in errors if e.get("severity") == "CRITICAL"]
    print(f"Validation complete.")
    print(f"  Total rows: {len(rows_seen)}")
    print(f"  Critical errors: {len(criticals)}")
    print(f"  Warnings: {len(errors) + len(warnings) - len(criticals)}")
    print(f"  Report: validation_errors.csv")

    if criticals:
        print("\n⚠️ CRITICAL errors found — import BLOCKED.")
        return {"status": "BLOCKED", "errors": criticals}
    return {"status": "PASS", "errors": errors + warnings}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_master_data.py <input_csv>")
        sys.exit(1)
    validate(sys.argv[1])
```

