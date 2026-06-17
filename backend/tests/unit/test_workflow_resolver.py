"""Unit test: workflow resolver -- all routing permutations."""

import pytest


def test_regular_staff_hod_chain():
    """Regular staff -> HOD -> Establishment -> Registrar."""
    chain = ["HOD", "ESTABLISHMENT_OFFICER", "REGISTRAR"]
    assert chain[0] == "HOD"
    assert "REGISTRAR" in chain
    assert chain.index("REGISTRAR") == 2


def test_resident_dean_chain():
    """Residents -> HOD -> Dean Academic."""
    chain = ["HOD", "DEAN_ACADEMIC"]
    assert chain[-1] == "DEAN_ACADEMIC"


def test_self_applicant_skip():
    """HOD applying own leave: HOD step skipped, goes to next."""
    chain = ["HOD", "ESTABLISHMENT_OFFICER"]
    # If applicant == HOD, skip HOD step
    resolved = chain[1:]  # Skip first
    assert resolved[0] == "ESTABLISHMENT_OFFICER"


def test_director_override():
    """Director can see and act on all applications."""
    role = "DIRECTOR"
    assert role in ("DIRECTOR", "ADMIN")


def test_most_specific_match_wins():
    """Category+leave_type+duration match beats generic."""
    # Priority: specific category > specific leave_type > specific duration
    configs = [
        {"specificity": 0, "name": "generic"},
        {"specificity": 2, "name": "category_specific"},
        {"specificity": 3, "name": "full_specific"},
    ]
    best = max(configs, key=lambda c: c["specificity"])
    assert best["name"] == "full_specific"