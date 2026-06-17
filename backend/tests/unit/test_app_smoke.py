from fastapi import FastAPI

from main import app


def test_app_imports_as_fastapi_instance():
    assert isinstance(app, FastAPI)
