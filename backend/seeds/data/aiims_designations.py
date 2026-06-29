"""AIIMS designation master — owner-provided list (2026-06-29).

Real working designations. Test designations (testDesig1..10, Test Staff, etc.)
in the DB are development-only.

Truncated names from source spreadsheet expanded; duplicate rows removed.
category_code maps to employee_categories (drives leave scheme).
grade_pay_level left None until AIIMS supplies pay levels per designation.
"""

# (name, category_code)
AIIMS_DESIGNATIONS = [
    # Faculty / clinical academics (CCS)
    ("Associate Professor", "FACULTY"),
    ("Additional Professor", "FACULTY"),
    ("Professor", "FACULTY"),
    ("Assistant Professor", "FACULTY"),
    ("Reader/Associate Professor", "FACULTY"),
    ("Lecturer", "FACULTY"),
    ("Tutor/Clinical Instructor", "FACULTY"),
    ("Dietician", "FACULTY"),
    ("Child Psychologist", "FACULTY"),
    ("Clinical Psychologist", "FACULTY"),
    ("Medical Physicist", "FACULTY"),
    # Nursing (CCS)
    ("Senior Nursing Officer", "NURSING"),
    ("Nursing Officer", "NURSING"),
    # Administration & support (CCS)
    ("Accounts Officer", "ADMIN"),
    ("Financial Advisor", "ADMIN"),
    ("Library & Information Officer", "ADMIN"),
    ("Warden (Hostel)", "ADMIN"),
    ("Assistant Administrative Officer", "ADMIN"),
    ("Junior Administrative Assistant", "ADMIN"),
    ("Junior Administrative Officer", "ADMIN"),
    ("Senior Administrative Assistant", "ADMIN"),
    ("Personal Assistant", "ADMIN"),
    ("Upper Division Clerk", "ADMIN"),
    ("Store Keeper", "ADMIN"),
    ("Medical Record Officer", "ADMIN"),
    ("Junior Engineer", "ADMIN"),
    ("Laundry Supervisor", "ADMIN"),
    ("Stenographer", "ADMIN"),
    ("Junior Accountant", "ADMIN"),
    ("Technician", "ADMIN"),
    ("Lab Technician", "ADMIN"),
    ("Junior Hindi Translator", "ADMIN"),
    ("Assistant Officer", "ADMIN"),
    ("Executive", "ADMIN"),
    ("Registrar", "ADMIN"),
    # Residents (RESIDENCY)
    ("P.G. Student", "JR_ACAD"),
    ("Junior Resident", "JR_ACAD"),
    ("Senior Resident", "SR_ACAD"),
    ("SR (Academic)", "SR_ACAD"),
]
