"""Seed 022 — Remove legacy generic Senior Resident designation.

Merges old short names into Senior Resident (Academic) / (Non-Academic).
Idempotent: safe if seed 020 already ran.
"""

import importlib

_MODULE = 'seeds.versions.020_jr_designation_rename'


def run(session):
    mod = importlib.import_module(_MODULE)
    mod.run(session)
