"""Shared employee field validation helpers."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

_NAME_RE = re.compile(r"^[A-Z\s.]+$")
_PAN_RE = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_NPS_RE = re.compile(r"^\d{12}$")
_PFMS_RE = re.compile(r"^[A-Z0-9]{14}$")
_ADDRESS_KEYS = ("flat", "street", "city", "state", "pin")


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
    code = str(value).strip().upper()
    if not _IFSC_RE.match(code):
        raise ValueError("IFSC must be 11 characters (e.g. SBIN0001234)")
    return code


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
    validate_employee_dates(
        dob=out.get("dob"),
        doj=out.get("doj"),
        next_increment_date=out.get("next_increment_date"),
    )
    return out
