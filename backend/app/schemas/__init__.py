"""Pydantic schemas for all API request/response models."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    emp_code: str = Field(max_length=20)
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


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department_code: Optional[str] = None
    designation_name: Optional[str] = None
    email: Optional[str] = None
    reporting_officer_code: Optional[str] = None
    is_active: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")


class SelfEmployeeUpdate(BaseModel):
    email: Optional[str] = None
    personal_email: Optional[str] = None
    model_config = ConfigDict(extra="forbid")


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
    is_active: bool
    user_id: Optional[str]
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
    model_config = ConfigDict(extra="forbid")


class DepartmentResponse(BaseModel):
    id: str
    code: str
    name: str
    parent_dept_id: Optional[str]
    managing_office: Optional[str]
    model_config = ConfigDict(from_attributes=True)


# â”€â”€ Designations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DesignationCreate(BaseModel):
    name: str = Field(max_length=150)
    grade_pay_level: Optional[str] = None
    category_code: Optional[str] = None


class DesignationResponse(BaseModel):
    id: str
    name: str
    grade_pay_level: Optional[str]
    category_code: Optional[str]
    model_config = ConfigDict(from_attributes=True)
