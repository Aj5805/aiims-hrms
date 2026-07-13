"""Seed 012 — Purge legacy test data and register 20 sample staff.

Uses real AIIMS department/designation masters (seeds 009/010).
Fields mirror the staff registration form. Pay level is per-employee only.

GATED: Only runs if APP_ENV != "production".
"""

from __future__ import annotations

import os
import uuid
from datetime import date

from sqlalchemy import text

from app.auth.jwt import hash_password
from app.data.staff_number_groups import STAFF_GROUP_CODES, format_staff_number
from seeds.purge_dev_data import purge_dev_staff

# (name, gender, dob, doj, dept_code, designation_name, staff_group, pay_level, mobile, email_local, father_name, blood_group, pan_suffix)
SAMPLE_STAFF = [
    ("Dr. Ananya Sharma", "FEMALE", "1985-04-12", "2012-07-01", "GENMED", "Associate Professor", "FAC", "Level 13", "9876501001", "ananya.sharma", "Rajesh Sharma", "B+", "A"),
    ("Dr. Vikram Reddy", "MALE", "1982-09-03", "2010-01-15", "GENSURG", "Professor", "FAC", "Level 14", "9876501002", "vikram.reddy", "Srinivas Reddy", "O+", "B"),
    ("Dr. Meera Iyer", "FEMALE", "1988-11-20", "2016-08-01", "PAEDS", "Assistant Professor", "FAC", "Level 12", "9876501003", "meera.iyer", "Krishnan Iyer", "A+", "C"),
    ("Dr. Arjun Patel", "MALE", "1990-06-08", "2019-03-01", "CARDIO", "Assistant Professor", "FAC", "Level 12", "9876501004", "arjun.patel", "Harsh Patel", "B+", "D"),
    ("Dr. Kavita Nair", "FEMALE", "1987-02-14", "2014-07-01", "OBGYN", "Additional Professor", "FAC", "Level 13", "9876501005", "kavita.nair", "Suresh Nair", "AB+", "E"),
    ("Smt. Lakshmi Devi", "FEMALE", "1991-05-25", "2015-04-01", "NURSING", "Nursing Officer", "NUR", "Level 7", "9876501006", "lakshmi.devi", "Rama Rao", "O+", "F"),
    ("Shri. Ramesh Kumar", "MALE", "1989-12-01", "2013-06-15", "NURSING", "Senior Nursing Officer", "NFS", "Level 8", "9876501007", "ramesh.kumar", "Gopal Kumar", "A+", "G"),
    ("Shri. Sanjay Gupta", "MALE", "1984-08-19", "2011-02-01", "ADMIN", "Accounts Officer", "DEP", "Level 8", "9876501008", "sanjay.gupta", "Mohan Gupta", "B+", "H"),
    ("Smt. Priya Thomas", "FEMALE", "1992-03-30", "2017-09-01", "FINANCE", "Junior Administrative Officer", "DEP", "Level 6", "9876501009", "priya.thomas", "Thomas Mathew", "O-", "J"),
    ("Shri. Amit Singh", "MALE", "1986-07-07", "2012-11-01", "MSO", "Medical Record Officer", "DEP", "Level 7", "9876501010", "amit.singh", "Harinder Singh", "A-", "K"),
    ("Dr. Rohit Malhotra", "MALE", "1993-01-18", "2020-07-01", "ANAES", "Junior Resident (Non-Academic)", "PGNA", "Level 10", "9876501011", "rohit.malhotra", "Anil Malhotra", "B+", "L"),
    ("Dr. Neha Kapoor", "FEMALE", "1992-10-05", "2021-07-01", "RADIODX", "Junior Resident (Non-Academic)", "PGNA", "Level 10", "9876501012", "neha.kapoor", "Raj Kapoor", "O+", "M"),
    ("Dr. Karan Joshi", "MALE", "1990-04-22", "2018-07-01", "PATH", "Senior Resident (Academic)", "SRAC", "Level 11", "9876501013", "karan.joshi", "Dev Joshi", "AB+", "N"),
    ("Dr. Divya Menon", "FEMALE", "1989-09-11", "2017-07-01", "PSYCH", "Senior Resident (Academic)", "SRAC", "Level 11", "9876501014", "divya.menon", "Vijay Menon", "A+", "P"),
    ("Dr. Aditya Bose", "MALE", "1994-06-16", "2022-07-01", "NEURO", "Junior Resident (Academic)", "PGJR", "Level 10", "9876501015", "aditya.bose", "Subhash Bose", "B-", "Q"),
    ("Shri. Manoj Yadav", "MALE", "1988-02-28", "2013-01-10", "ENGINE", "Junior Engineer", "DEP", "Level 6", "9876501016", "manoj.yadav", "Ram Yadav", "O+", "R"),
    ("Smt. Rekha Pillai", "FEMALE", "1990-11-09", "2014-05-20", "LIBRARY", "Library & Information Officer", "DEP", "Level 7", "9876501017", "rekha.pillai", "Krishna Pillai", "A+", "S"),
    ("Shri. Deepak Verma", "MALE", "1987-08-04", "2012-03-15", "STORES", "Store Keeper", "DEP", "Level 4", "9876501018", "deepak.verma", "Shyam Verma", "B+", "T"),
    ("Smt. Anjali Desai", "FEMALE", "1991-12-23", "2016-01-05", "HOSPADMIN", "Stenographer", "DEP", "Level 4", "9876501019", "anjali.desai", "Mahesh Desai", "O+", "U"),
    ("Dr. Suresh Babu", "MALE", "1983-05-17", "2009-07-01", "ORTHO", "Reader/Associate Professor", "FAC", "Level 13", "9876501020", "suresh.babu", "Venkat Babu", "AB-", "V"),
]

def _purge_test_data(session) -> None:
    purge_dev_staff(session)
    print("  Purged all employees and non-admin users (kept admin login only).")


def _next_emp_code(session, staff_group: str) -> str:
    row = session.execute(
        text(
            """
            UPDATE staff_number_sequences
            SET last_number = last_number + 1, updated_at = now()
            WHERE group_code = :g
            RETURNING last_number
            """
        ),
        {"g": staff_group},
    ).fetchone()
    if not row:
        raise RuntimeError(f"Staff number sequence missing for {staff_group} — run seed 011 first.")
    return format_staff_number(staff_group, int(row[0]))


def _lookup_id(session, table: str, column: str, value: str) -> str | None:
    row = session.execute(
        text(f"SELECT id FROM {table} WHERE {column} = :v"),
        {"v": value},
    ).fetchone()
    return str(row[0]) if row else None


def _seed_sample_staff(session) -> None:
    created = 0
    skipped = 0
    for idx, row in enumerate(SAMPLE_STAFF, start=1):
        (
            name, gender, dob, doj, dept_code, desig_name, staff_group, pay_level,
            mobile, email_local, father_name, blood_group, pan_suffix,
        ) = row

        email = f"{email_local}@aiims.ac.in"
        existing = session.execute(
            text("SELECT id FROM employees WHERE email = :e OR name = :n"),
            {"e": email, "n": name},
        ).fetchone()
        if existing:
            skipped += 1
            continue

        cat_code = session.execute(
            text(
                """
                SELECT c.code FROM designations d
                JOIN employee_categories c ON c.id = d.category_id
                WHERE d.name = :n
                """
            ),
            {"n": desig_name},
        ).fetchone()
        if not cat_code:
            print(f"  WARN: designation not found: {desig_name} — skip {name}")
            continue

        dept_id = _lookup_id(session, "departments", "code", dept_code)
        desig_id = _lookup_id(session, "designations", "name", desig_name)
        cat_id = _lookup_id(session, "employee_categories", "code", cat_code[0])
        if not dept_id or not desig_id or not cat_id:
            print(f"  WARN: master data missing for {name} — skip")
            continue

        if staff_group not in STAFF_GROUP_CODES:
            print(f"  WARN: invalid staff group {staff_group} for {name}")
            continue

        emp_code = _next_emp_code(session, staff_group)
        eid = str(uuid.uuid4())
        pan = f"ABCDE{1000 + idx:04d}{pan_suffix}"
        aadhaar = f"{100012345678 + idx:012d}"[:12]

        session.execute(
            text(
                """
                INSERT INTO employees
                    (id, emp_code, name, gender, dob, doj, category_id, department_id,
                     designation_id, email, has_institutional_email, personal_email,
                     father_name, blood_group, mobile, staff_group, pay_level,
                     pan, aadhaar, doj_actual, marital_status, address, permanent_address)
                VALUES
                    (:id, :ec, :nm, :g, :dob, :doj, :cat, :dept, :des, :em, true, :pe,
                     :father, :blood, :mobile, :sg, :pl, :pan, :aadhaar, :doj, 'Married',
                     :addr, :addr)
                """
            ),
            {
                "id": eid,
                "ec": emp_code,
                "nm": name,
                "g": gender,
                "dob": dob,
                "doj": doj,
                "cat": cat_id,
                "dept": dept_id,
                "des": desig_id,
                "em": email,
                "pe": email.replace("@aiims.ac.in", "@gmail.com"),
                "father": father_name,
                "blood": blood_group,
                "mobile": mobile,
                "sg": staff_group,
                "pl": pay_level,
                "pan": pan,
                "aadhaar": aadhaar,
                "addr": f"AIIMS Staff Quarters, Block {idx % 5 + 1}, Hyderabad",
            },
        )

        session.execute(
            text(
                """
                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password)
                VALUES (uuid_generate_v4(), :un, :ph, :eid, 'STAFF', true, false)
                ON CONFLICT (username) DO NOTHING
                """
            ),
            {"un": emp_code, "ph": hash_password(emp_code), "eid": eid},
        )

        # Opening EL balance for CCS staff; residents get ANNUAL_RES where applicable
        lt_code = "ANNUAL_RES" if cat_code[0] in ("JR_ACAD", "SR_ACAD") else "EL"
        session.execute(
            text(
                """
                INSERT INTO leave_balances
                    (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                SELECT gen_random_uuid(), :eid, lt.id, :yr, :ys, :ob, 0
                FROM leave_types lt
                WHERE lt.code = :ltc
                AND NOT EXISTS (
                    SELECT 1 FROM leave_balances lb
                    WHERE lb.employee_id = :eid AND lb.leave_type_id = lt.id AND lb.leave_year = :yr
                )
                """
            ),
            {
                "eid": eid,
                "ltc": lt_code,
                "yr": date.today().year,
                "ys": date(date.today().year, 4, 1),
                "ob": 15 if lt_code == "EL" else 24,
            },
        )
        created += 1

    print(f"  Sample staff: {created} created, {skipped} already present (skipped).")


def run(session):
    if os.environ.get("APP_ENV") == "production":
        print("Skipping sample staff seed in production.")
        return

    if os.environ.get("PURGE_DEV_STAFF") == "1":
        _purge_test_data(session)
    else:
        print("  Skipping purge (set PURGE_DEV_STAFF=1 to wipe employees).")

    if os.environ.get("SEED_SAMPLE_STAFF") == "1":
        _seed_sample_staff(session)
    else:
        print("  Skipping sample staff (set SEED_SAMPLE_STAFF=1 or purge_test_data.py --reseed).")
    print("Seed 012 complete.")
