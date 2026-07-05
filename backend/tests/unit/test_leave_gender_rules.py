"""Gender-based leave eligibility."""

from app.services.leave_rules import gender_eligibility_allowed


def test_ccl_female_only():
    rules = {"gender_eligibility": "FEMALE_ONLY"}
    assert gender_eligibility_allowed(rules, "FEMALE") is True
    assert gender_eligibility_allowed(rules, "MALE") is False


def test_paternity_male_only():
    rules = {"gender_eligibility": "MALE_ONLY"}
    assert gender_eligibility_allowed(rules, "MALE") is True
    assert gender_eligibility_allowed(rules, "FEMALE") is False


def test_all_genders_when_unset():
    assert gender_eligibility_allowed(None, "MALE") is True
    assert gender_eligibility_allowed({}, "FEMALE") is True
