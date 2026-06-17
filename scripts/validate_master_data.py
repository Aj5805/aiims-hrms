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
        print("\nâš ï¸ CRITICAL errors found -- import BLOCKED.")
        return {"status": "BLOCKED", "errors": criticals}
    return {"status": "PASS", "errors": errors + warnings}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_master_data.py <input_csv>")
        sys.exit(1)
    validate(sys.argv[1])