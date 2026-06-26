"""Test configuration and shared fixtures."""

import pytest
import asyncio
from app.core.database import engine
from app.core.rate_limit import limiter

# Disable rate limiting by default in tests to prevent 429 throttling
limiter.enabled = False

@pytest.fixture(autouse=True)
def cleanup_connections():
    yield
    # Dispose the asyncpg engine connections to prevent "Event loop is closed" errors on Windows
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        loop.create_task(engine.dispose())
    else:
        loop.run_until_complete(engine.dispose())

