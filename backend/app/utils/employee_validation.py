"""Shared employee field validation helpers."""

from __future__ import annotations

import json
import re
from datetime import date

from typing import Any

_NAME_RE = re.compile(r"^[A-Z\s.]+$")
_PAN_RE = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_BANK_ACCT_RE = re.compile(r"^\d{9,18}$")
_NPS_RE = re.compile(r"^\d{12}$")
_PFMS_RE = re.compile(r"^[A-Z0-9]{14}$")
_ADDRESS_KEYS = ("flat", "street", "city", "state", "pin")
_MIN_DATE_YEAR = 1900
_MAX_DATE_YEAR = 2099
_ISO_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def normalize_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z\s.]", "", value or "").upper()
    if not cleaned.strip():
        raise ValueError("Name may only contain letters, spaces, and periods")
    return cleaned


def validate_email_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    email = str(value).strip()
    parts = email.split("@")
    if len(parts) != 2:
        raise ValueError("Email must contain exactly one @ and a domain with .")
    local, domain = parts
    if not local or not domain or "@" in domain:
        raise ValueError("Email must contain exactly one @ and a domain with .")
    if "." not in domain or domain.endswith("."):
        raise ValueError("Email must contain exactly one @ and a domain with .")
    return email


def validate_mobile_optional(value: str | None, label: str = "Mobile") -> str | None:
    if value is None or str(value).strip() == "":
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) != 10:
        raise ValueError(f"{label} must be exactly 10 digits")
    return digits


def validate_pan_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    pan = str(value).strip().upper()
    if not _PAN_RE.match(pan):
        raise ValueError("PAN must be in format ABCDE1234F")
    return pan


def validate_ifsc_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    code = re.sub(r"[^A-Z0-9]", "", str(value).strip().upper())
    if len(code) >= 5 and code[4] == "O":
        code = code[:4] + "0" + code[5:]
    if not _IFSC_RE.match(code):
        raise ValueError("IFSC must be 11 characters (e.g. SBIN0001234)")
    return code


def validate_bank_account_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    digits = re.sub(r"\D", "", str(value))
    if not _BANK_ACCT_RE.match(digits):
        raise ValueError("Bank account must be 9–18 digits with no spaces")
    return digits


def validate_nps_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    digits = re.sub(r"\D", "", str(value))
    if not _NPS_RE.match(digits):
        raise ValueError("NPS number must be exactly 12 digits")
    return digits


def validate_pfms_optional(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    code = re.sub(r"[^A-Z0-9]", "", str(value).upper())
    if not _PFMS_RE.match(code):
        raise ValueError("PFMS code must be exactly 14 alphanumeric characters")
    return code


def validate_grade_group(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    code = str(value).strip().upper()
    if code not in ("A", "B", "C"):
        raise ValueError("Grade must be A, B, or C")
    return code


def normalize_address_field(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip()
    if not raw.startswith("{"):
        return raw.upper()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Address must be valid structured data") from exc
    if not isinstance(data, dict):
        raise ValueError("Address must be a structured object")
    normalized: dict[str, str] = {}
    for key in _ADDRESS_KEYS:
        part = str(data.get(key, "") or "").strip()
        if key == "pin":
            part = re.sub(r"\D", "", part)
            if part and len(part) != 6:
                raise ValueError("PIN must be exactly 6 digits")
        else:
            part = part.upper()
        normalized[key] = part
    has_content = any(normalized[k] for k in _ADDRESS_KEYS)
    if has_content:
        if not normalized["city"]:
            raise ValueError("Village/Town/City is required when address is entered")
        if not normalized["state"]:
            raise ValueError("State is required when address is entered")
    if not has_content:
        return None
    return json.dumps(normalized)


def validate_calendar_date(value: date | None, *, field: str = "Date") -> date | None:
    """Ensure a date falls within the allowed year range (calendar validity assumed)."""
    if value is None:
        return None
    if value.year < _MIN_DATE_YEAR or value.year > _MAX_DATE_YEAR:
        raise ValueError(f"{field} year must be between {_MIN_DATE_YEAR} and {_MAX_DATE_YEAR}")
    return value


def parse_iso_date_string(value: str, *, field: str = "Date") -> date:
    """Parse YYYY-MM-DD with strict year, month, and day rules."""
    match = _ISO_DATE_RE.fullmatch(str(value).strip())
    if not match:
        raise ValueError(f"{field} must be in YYYY-MM-DD format")
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if year < _MIN_DATE_YEAR or year > _MAX_DATE_YEAR:
        raise ValueError(f"{field} year must be between {_MIN_DATE_YEAR} and {_MAX_DATE_YEAR}")
    if month < 1 or month > 12:
        raise ValueError(f"{field} month must be between 01 and 12")
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise ValueError(f"{field} is not a valid calendar date") from exc


def _is_july_increment_cycle(doj: date) -> bool:
    """Jul 2–Dec 31 and 1 Jan → July increment cycle."""
    if doj.month == 1 and doj.day == 1:
        return True
    if doj.month == 7 and doj.day >= 2:
        return True
    return doj.month >= 8


def suggest_next_increment_date(doj: date) -> date:
    """Jul 2–Jan 1 DOJ → upcoming 1 Jul; Jan 2–Jul 1 DOJ → upcoming 1 Jan."""
    if _is_july_increment_cycle(doj):
        if doj.month == 1:
            return date(doj.year, 7, 1)
        return date(doj.year + 1, 7, 1)
    return date(doj.year + 1, 1, 1)


def validate_employee_dates(
    *,
    dob: date | None,
    doj: date | None,
    next_increment_date: date | None = None,
) -> None:
    today = date.today()
    if dob and dob > today:
        raise ValueError("Date of birth cannot be in the future")
    if doj and doj > today:
        raise ValueError("Date of joining cannot be in the future")
    if dob and doj and dob >= doj:
        raise ValueError("Date of birth must be before date of joining")
    if doj and next_increment_date and next_increment_date < doj:
        raise ValueError("Next increment cannot be before date of joining")


def apply_registration_validators(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize and validate optional registration fields on create/update payloads."""
    out = dict(data)
    if "name" in out and out["name"] is not None:
        out["name"] = normalize_name(str(out["name"]))
    for field in ("email", "personal_email"):
        if field in out:
            out[field] = validate_email_optional(out.get(field))
    if "mobile" in out:
        out["mobile"] = validate_mobile_optional(out.get("mobile"), "Mobile")
    if "alt_mobile" in out:
        out["alt_mobile"] = validate_mobile_optional(out.get("alt_mobile"), "Alt mobile")
    if "pan" in out:
        out["pan"] = validate_pan_optional(out.get("pan"))
    if "ifsc_code" in out:
        out["ifsc_code"] = validate_ifsc_optional(out.get("ifsc_code"))
    if "bank_account_no" in out:
        out["bank_account_no"] = validate_bank_account_optional(out.get("bank_account_no"))
    if "nps_or_gpf_no" in out:
        out["nps_or_gpf_no"] = validate_nps_optional(out.get("nps_or_gpf_no"))
    if "pfms_code" in out:
        out["pfms_code"] = validate_pfms_optional(out.get("pfms_code"))
    if "grade" in out:
        out["grade"] = validate_grade_group(out.get("grade"))
    if "aadhaar" in out and out.get("aadhaar"):
        digits = re.sub(r"\D", "", str(out["aadhaar"]))
        if len(digits) != 12:
            raise ValueError("Aadhaar must be exactly 12 digits")
        out["aadhaar"] = digits
    for field in ("address", "permanent_address"):
        if field in out:
            out[field] = normalize_address_field(out.get(field))
    for field in ("father_name", "religion", "bank_name", "last_qualification", "initial"):
        if field in out and out[field] not in (None, ""):
            out[field] = str(out[field]).upper()
    for field in ("dob", "doj", "doj_actual", "dol_last_working", "next_increment_date"):
        if field in out and out.get(field) is not None:
            label = field.replace("_", " ").title()
            out[field] = validate_calendar_date(out[field], field=label)
    if out.get("doj") and out.get("next_increment_date") is None:
        out["next_increment_date"] = suggest_next_increment_date(out["doj"])
    validate_employee_dates(
        dob=out.get("dob"),
        doj=out.get("doj"),
        next_increment_date=out.get("next_increment_date"),
    )
    return out
