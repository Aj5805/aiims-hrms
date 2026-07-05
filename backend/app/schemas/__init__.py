"""Pydantic schemas for all API request/response models."""

import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.employee_validation import (
    normalize_name,
    normalize_address_field,
    validate_calendar_date,
    validate_bank_account_optional,
    validate_email_optional,
    validate_grade_group,
    validate_mobile_optional,
    validate_nps_optional,
    validate_pan_optional,
    validate_pfms_optional,
    validate_ifsc_optional,
    validate_employee_dates,
)


def validate_password_complexity(value: str) -> str:
    failures: list[str] = []
    if len(value) < 8:
        failures.append("at least 8 characters")
    if not any(char.isupper() for char in value):
        failures.append("at least 1 uppercase letter")
    if not any(char.isdigit() for char in value):
        failures.append("at least 1 digit")
    if not any(not char.isalnum() for char in value):
        failures.append("at least 1 special character")
    if failures:
        raise ValueError("Password must contain " + ", ".join(failures))
    return value


# â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 28800  # 8h
    user: dict  # {id, username, role, must_change_password}


class PasswordResetRequest(BaseModel):
    user_id: str
    new_password: str

    _validate_new_password = field_validator("new_password")(validate_password_complexity)


class SelfPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    _validate_new_password = field_validator("new_password")(validate_password_complexity)


# â”€â”€ Employees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class EmployeeBase(BaseModel):
    emp_code: Optional[str] = Field(None, max_length=20)
    name: str = Field(max_length=200)
    gender: str = Field(pattern="^(MALE|FEMALE|OTHER)$")
    dob: Optional[date] = None
    doj: date
    category_code: str
    department_code: str
    designation_name: str
    email: Optional[str] = None
    has_institutional_email: bool = False
    personal_email: Optional[str] = None
    # Extended registration fields
    initial: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    permanent_address: Optional[str] = None
    marital_status: Optional[str] = Field(None, max_length=20)
    father_name: Optional[str] = Field(None, max_length=200)
    blood_group: Optional[str] = Field(None, max_length=10)
    photo: Optional[str] = Field(None, max_length=500)
    mobile: Optional[str] = Field(None, max_length=15)
    alt_mobile: Optional[str] = Field(None, max_length=15)
    last_qualification: Optional[str] = Field(None, max_length=200)
    doj_actual: Optional[date] = None
    dol_last_working: Optional[date] = None
    next_increment_date: Optional[date] = None
    staff_group: Optional[str] = Field(None, max_length=50)
    is_physically_handicapped: bool = False
    type_of_flat: Optional[str] = Field(None, max_length=50)
    caste_category: Optional[str] = Field(None, max_length=30)
    religion: Optional[str] = Field(None, max_length=50)
    bank_account_no: Optional[str] = Field(None, max_length=30)
    bank_name: Optional[str] = Field(None, max_length=150)
    ifsc_code: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    aadhaar: Optional[str] = Field(None, max_length=12)
    nps_or_gpf_no: Optional[str] = Field(None, max_length=30)
    pfms_code: Optional[str] = Field(None, max_length=30)
    grade: Optional[str] = Field(None, max_length=20)
    pay_level: Optional[str] = Field(None, max_length=20)


class OnboardingLeaveCreditItem(BaseModel):
    leave_type_code: str = Field(..., min_length=1, max_length=20)
    credited: float = Field(..., ge=0)


class OnboardingLeaveCreditPreview(BaseModel):
    leave_type_code: str
    leave_type_name: str
    credit_frequency: Optional[str] = None
    suggested_credit: float


class EmployeeCreate(EmployeeBase):
    staff_group: str = Field(..., max_length=50)
    onboarding_leave_credits: Optional[list[OnboardingLeaveCreditItem]] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return normalize_name(v)

    @field_validator("email", "personal_email")
    @classmethod
    def _validate_email(cls, v):
        return validate_email_optional(v)

    @field_validator("mobile")
    @classmethod
    def _validate_mobile(cls, v):
        return validate_mobile_optional(v, "Mobile")

    @field_validator("alt_mobile")
    @classmethod
    def _validate_alt_mobile(cls, v):
        return validate_mobile_optional(v, "Alt mobile")

    @field_validator("pan")
    @classmethod
    def _validate_pan(cls, v):
        return validate_pan_optional(v)

    @field_validator("ifsc_code")
    @classmethod
    def _validate_ifsc(cls, v):
        return validate_ifsc_optional(v)

    @field_validator("bank_account_no")
    @classmethod
    def _validate_bank_account_create(cls, v):
        return validate_bank_account_optional(v)

    @field_validator("grade")
    @classmethod
    def _validate_grade(cls, v):
        return validate_grade_group(v)

    @field_validator("nps_or_gpf_no")
    @classmethod
    def _validate_nps(cls, v):
        return validate_nps_optional(v)

    @field_validator("pfms_code")
    @classmethod
    def _validate_pfms(cls, v):
        return validate_pfms_optional(v)

    @field_validator("address", "permanent_address")
    @classmethod
    def _validate_address(cls, v):
        return normalize_address_field(v)

    @field_validator("staff_group")
    @classmethod
    def staff_group_not_blank(cls, v: str) -> str:
        code = (v or "").strip().upper()
        if not code:
            raise ValueError("staff_group is required for auto staff number allotment")
        return code

    @field_validator("aadhaar")
    @classmethod
    def _validate_aadhaar_create(cls, v):
        if v is None or str(v).strip() == "":
            return None
        digits = re.sub(r"\D", "", str(v))
        if len(digits) != 12:
            raise ValueError("Aadhaar must be exactly 12 digits")
        return digits

    @field_validator("dob", "doj", "doj_actual", "dol_last_working", "next_increment_date")
    @classmethod
    def _validate_calendar_dates_create(cls, v, info):
        if v is None:
            return v
        label = str(info.field_name).replace("_", " ").title()
        return validate_calendar_date(v, field=label)

    @field_validator(
        "father_name", "religion", "bank_name", "last_qualification", "initial", "pay_level",
        mode="before",
    )
    @classmethod
    def _uppercase_optional_text_create(cls, v):
        if v is None or v == "":
            return v
        return str(v).upper()

    @model_validator(mode="after")
    def validate_registration(self):
        validate_employee_dates(
            dob=self.dob,
            doj=self.doj,
            next_increment_date=self.next_increment_date,
        )
        if not (self.emp_code or "").strip() and not (self.staff_group or "").strip():
            raise ValueError("Provide staff_group for auto allotment or an explicit emp_code")
        return self


class StaffGroupInfo(BaseModel):
    code: str
    label: str


class StaffNumberPreview(BaseModel):
    next_emp_code: str


class StaffGroupSuggestion(BaseModel):
    staff_group: str | None
    label: str | None = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = Field(None, pattern="^(MALE|FEMALE|OTHER)$")
    dob: Optional[date] = None
    doj: Optional[date] = None
    department_code: Optional[str] = None
    designation_name: Optional[str] = None
    email: Optional[str] = None
    personal_email: Optional[str] = None
    initial: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    permanent_address: Optional[str] = None
    marital_status: Optional[str] = Field(None, max_length=20)
    father_name: Optional[str] = Field(None, max_length=200)
    blood_group: Optional[str] = Field(None, max_length=10)
    mobile: Optional[str] = Field(None, max_length=15)
    alt_mobile: Optional[str] = Field(None, max_length=15)
    last_qualification: Optional[str] = Field(None, max_length=200)
    next_increment_date: Optional[date] = None
    is_physically_handicapped: Optional[bool] = None
    caste_category: Optional[str] = Field(None, max_length=30)
    religion: Optional[str] = Field(None, max_length=50)
    bank_account_no: Optional[str] = Field(None, max_length=30)
    bank_name: Optional[str] = Field(None, max_length=150)
    ifsc_code: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    aadhaar: Optional[str] = Field(None, max_length=12)
    nps_or_gpf_no: Optional[str] = Field(None, max_length=30)
    pfms_code: Optional[str] = Field(None, max_length=30)
    grade: Optional[str] = Field(None, max_length=20)
    pay_level: Optional[str] = Field(None, max_length=20)
    reporting_officer_code: Optional[str] = None
    category_code: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v):
        return normalize_name(v) if v is not None else v

    @field_validator("email", "personal_email")
    @classmethod
    def _validate_email(cls, v):
        return validate_email_optional(v)

    @field_validator("mobile")
    @classmethod
    def _validate_mobile(cls, v):
        return validate_mobile_optional(v, "Mobile")

    @field_validator("alt_mobile")
    @classmethod
    def _validate_alt_mobile(cls, v):
        return validate_mobile_optional(v, "Alt mobile")

    @field_validator("pan")
    @classmethod
    def _validate_pan(cls, v):
        return validate_pan_optional(v)

    @field_validator("ifsc_code")
    @classmethod
    def _validate_ifsc(cls, v):
        return validate_ifsc_optional(v)

    @field_validator("bank_account_no")
    @classmethod
    def _validate_bank_account_update(cls, v):
        return validate_bank_account_optional(v)

    @field_validator("grade")
    @classmethod
    def _validate_grade(cls, v):
        return validate_grade_group(v)

    @field_validator("nps_or_gpf_no")
    @classmethod
    def _validate_nps(cls, v):
        return validate_nps_optional(v)

    @field_validator("pfms_code")
    @classmethod
    def _validate_pfms(cls, v):
        return validate_pfms_optional(v)

    @field_validator("address", "permanent_address")
    @classmethod
    def _validate_address(cls, v):
        return normalize_address_field(v)

    @field_validator("aadhaar")
    @classmethod
    def _validate_aadhaar(cls, v):
        if v is None or str(v).strip() == "":
            return None
        digits = re.sub(r"\D", "", str(v))
        if len(digits) != 12:
            raise ValueError("Aadhaar must be exactly 12 digits")
        return digits

    @field_validator("dob", "doj", "next_increment_date")
    @classmethod
    def _validate_calendar_dates_update(cls, v, info):
        if v is None:
            return v
        label = str(info.field_name).replace("_", " ").title()
        return validate_calendar_date(v, field=label)


class SelfEmployeeUpdate(BaseModel):
    """Non-critical fields staff may update on their own profile."""
    email: Optional[str] = None
    personal_email: Optional[str] = None
    mobile: Optional[str] = Field(None, max_length=15)
    alt_mobile: Optional[str] = Field(None, max_length=15)
    father_name: Optional[str] = Field(None, max_length=200)
    religion: Optional[str] = Field(None, max_length=50)
    last_qualification: Optional[str] = Field(None, max_length=200)
    marital_status: Optional[str] = Field(None, max_length=20)
    blood_group: Optional[str] = Field(None, max_length=10)
    initial: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    permanent_address: Optional[str] = None
    model_config = ConfigDict(extra="forbid")

    @field_validator("email", "personal_email")
    @classmethod
    def _validate_email(cls, v):
        return validate_email_optional(v)

    @field_validator("mobile")
    @classmethod
    def _validate_mobile(cls, v):
        return validate_mobile_optional(v, "Mobile")

    @field_validator("alt_mobile")
    @classmethod
    def _validate_alt_mobile(cls, v):
        return validate_mobile_optional(v, "Alt mobile")

    @field_validator("address", "permanent_address")
    @classmethod
    def _validate_address(cls, v):
        return normalize_address_field(v)


class EmployeeResponse(BaseModel):
    id: str
    emp_code: str
    name: str
    gender: str
    dob: Optional[date]
    doj: date
    category_code: str
    category_name: str
    department_code: str
    department_name: str
    designation_name: str
    email: Optional[str]
    has_institutional_email: bool
    personal_email: Optional[str] = None
    is_active: bool
    user_id: Optional[str]
    initial: Optional[str] = None
    address: Optional[str] = None
    permanent_address: Optional[str] = None
    marital_status: Optional[str] = None
    father_name: Optional[str] = None
    blood_group: Optional[str] = None
    photo: Optional[str] = None
    mobile: Optional[str] = None
    alt_mobile: Optional[str] = None
    last_qualification: Optional[str] = None
    doj_actual: Optional[date] = None
    dol_last_working: Optional[date] = None
    next_increment_date: Optional[date] = None
    staff_group: Optional[str] = None
    is_physically_handicapped: bool = False
    type_of_flat: Optional[str] = None
    caste_category: Optional[str] = None
    religion: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    nps_or_gpf_no: Optional[str] = None
    pfms_code: Optional[str] = None
    grade: Optional[str] = None
    pay_level: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# â”€â”€ CSV Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class CsvImportRow(BaseModel):
    row_number: int
    emp_code: str
    status: str  # "success" | "error"
    message: Optional[str] = None


class CsvImportResult(BaseModel):
    total_rows: int
    success_count: int
    error_count: int
    rows: list[CsvImportRow]


# â”€â”€ Departments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DepartmentCreate(BaseModel):
    code: str = Field(max_length=20)
    name: str = Field(max_length=150)
    parent_dept_code: Optional[str] = None
    managing_office: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    managing_office: Optional[str] = None
    is_active: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")


class DepartmentResponse(BaseModel):
    id: str
    code: str
    name: str
    parent_dept_id: Optional[str]
    managing_office: Optional[str]
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


# â”€â”€ Designations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DesignationCreate(BaseModel):
    name: str = Field(max_length=150)
    grade_pay_level: Optional[str] = None
    category_code: Optional[str] = None


class DesignationUpdate(BaseModel):
    name: Optional[str] = None
    grade_pay_level: Optional[str] = None
    category_code: Optional[str] = None
    is_active: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")


class DesignationResponse(BaseModel):
    id: str
    name: str
    grade_pay_level: Optional[str]
    category_code: Optional[str]
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)
    model_config = ConfigDict(from_attributes=True)
