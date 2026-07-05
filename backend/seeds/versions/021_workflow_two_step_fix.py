"""Seed 021 — Remove legacy 3-step workflows; enforce HOD → Nodal Officer (final at step 2)."""

import importlib

_seed016 = importlib.import_module("seeds.versions.016_nodal_workflow_routing")


def run(session):
    _seed016.run(session)
