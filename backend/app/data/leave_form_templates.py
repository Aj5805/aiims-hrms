"""AIIMS Bibinagar leave application form catalogue (institutional proformas).

Source: https://aiimsbibinagar.edu.in/forms.html
Forms are hosted on the institute website; URLs point to the official forms page
or published PDF paths where available.
"""

LEAVE_FORM_TEMPLATES: list[dict] = [
    {
        "id": "bib-res-el-ml",
        "title": "Earned Leave / Medical Leave — Senior & Junior Residents",
        "categories": ["JR_ACAD", "JR_NON_ACAD", "SR_ACAD", "SR_NON_ACAD"],
        "leave_types": ["ANNUAL_RES", "EOL", "ML"],
        "purposes": ["APPLY", "MEDICAL"],
        "employee_groups": ["RESIDENCY"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
        "notes": "Application Form for Earned Leave/Medical Leave of SR/JR",
    },
    {
        "id": "bib-academic-domestic",
        "title": "Academic Leave — Domestic Visit",
        "categories": ["FACULTY"],
        "leave_types": ["STUDY", "OD"],
        "purposes": ["ACADEMIC", "APPLY"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
        "notes": "Academic Leave form for Domestic Visit",
    },
    {
        "id": "bib-academic-abroad",
        "title": "Academic Leave — Abroad Visit",
        "categories": ["FACULTY"],
        "leave_types": ["STUDY", "SABBATICAL"],
        "purposes": ["ACADEMIC", "APPLY"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
        "notes": "Academic Leave form for Abroad Visits",
    },
    {
        "id": "bib-academic-examiner",
        "title": "Academic Leave — External Examiner",
        "categories": ["FACULTY"],
        "leave_types": ["OD", "STUDY"],
        "purposes": ["ACADEMIC"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
    },
    {
        "id": "bib-nursing-cl-rh",
        "title": "Casual Leave / Restricted Holiday — Nursing Officers",
        "categories": ["NURSING"],
        "leave_types": ["CL"],
        "purposes": ["APPLY"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
        "notes": "CL/RH Application of Nursing Officers",
    },
    {
        "id": "bib-nursing-el-hpl-family",
        "title": "EL / HPL / Maternity / CCL / Paternity — Nursing Officers",
        "categories": ["NURSING"],
        "leave_types": ["EL", "HPL", "ML", "CCL", "PL"],
        "purposes": ["APPLY", "MEDICAL"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
    },
    {
        "id": "bib-staff-el-hpl-eol-ccl",
        "title": "EL / HPL / EOL / CCL — Faculty & Non-Faculty",
        "categories": ["FACULTY", "ADMIN"],
        "leave_types": ["EL", "HPL", "EOL", "CCL"],
        "purposes": ["APPLY"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
        "notes": "Standard CCS leave application (scheduled form pattern)",
    },
    {
        "id": "bib-staff-cl",
        "title": "Casual Leave Application — Faculty & Admin Staff",
        "categories": ["FACULTY", "ADMIN"],
        "leave_types": ["CL"],
        "purposes": ["APPLY"],
        "employee_groups": ["CCS"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
    },
    {
        "id": "bib-departure-el",
        "title": "Departure Report — Availing EL / HPL / Maternity / CCL / PL",
        "categories": ["NURSING", "FACULTY", "ADMIN"],
        "leave_types": ["EL", "HPL", "ML", "CCL", "PL", "ANNUAL_RES"],
        "purposes": ["DEPARTURE"],
        "employee_groups": ["CCS", "RESIDENCY"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
    },
    {
        "id": "bib-rejoin-el",
        "title": "Rejoining Letter after Availing Leave",
        "categories": ["NURSING", "FACULTY", "ADMIN", "JR_ACAD", "SR_ACAD"],
        "leave_types": ["EL", "HPL", "ML", "CCL", "PL", "ANNUAL_RES", "CL"],
        "purposes": ["REJOIN"],
        "employee_groups": ["CCS", "RESIDENCY"],
        "source": "AIIMS Bibinagar",
        "url": "https://aiimsbibinagar.edu.in/forms.html",
        "format": "PDF",
    },
    {
        "id": "bib-modify-cancel",
        "title": "Leave Modification / Cancellation Request",
        "categories": ["FACULTY", "NURSING", "ADMIN", "JR_ACAD", "JR_NON_ACAD", "SR_ACAD", "SR_NON_ACAD"],
        "leave_types": [],
        "purposes": ["MODIFICATION", "CANCELLATION"],
        "employee_groups": ["CCS", "RESIDENCY"],
        "source": "AIIMS HRMS",
        "url": "",
        "format": "IN_APP",
        "notes": "Submit via My Applications → Request change on an approved leave",
    },
]


def filter_form_templates(
    *,
    category_code: str | None = None,
    leave_type_code: str | None = None,
    purpose: str | None = None,
) -> list[dict]:
    results = []
    for item in LEAVE_FORM_TEMPLATES:
        if category_code and category_code not in item["categories"]:
            if item["categories"]:
                continue
        if leave_type_code and item["leave_types"] and leave_type_code not in item["leave_types"]:
            continue
        if purpose and purpose not in item["purposes"]:
            continue
        results.append(item)
    return results
