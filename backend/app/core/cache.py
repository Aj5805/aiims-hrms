"""In-memory TTL cache wrapper (cachetools).

Redis is deferred to v2 â€” this is sufficient for <50 concurrent users.
"""

from cachetools import TTLCache

_default_cache: TTLCache = TTLCache(maxsize=1024, ttl=300)


def get_cache() -> TTLCache:
    return _default_cache


def cached(key: str):
    """Returns cached value or None."""
    return _default_cache.get(key)


def cache_set(key: str, value):
    _default_cache[key] = value


def cache_clear():
    _default_cache.clear()