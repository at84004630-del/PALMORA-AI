"""
Unified Ephemeral Cache & Distributed Rate-Limiting Module for Palmora AI
Supports Upstash Redis (Serverless REST), standard Redis connection string (rediss://),
and automatic fallback to an in-memory TTL dictionary for local development and offline resilience.
"""

import time
import json
import logging
from typing import Optional, Any, Dict, Tuple
import httpx
from .config import settings

logger = logging.getLogger("palmora.cache")

class InMemoryTTLStore:
    """Thread-safe in-memory cache with explicit per-key expiration timestamps."""
    def __init__(self):
        self._store: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        self._evict_expired()
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.time() > expiry:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int = 900) -> bool:
        self._evict_expired()
        expiry = time.time() + max(1, ttl_seconds)
        self._store[key] = (value, expiry)
        return True

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None

    def increment(self, key: str, window_seconds: int = 60) -> Tuple[int, int]:
        """Atomically increments key counter and returns (current_count, ttl_remaining)."""
        self._evict_expired()
        now = time.time()
        entry = self._store.get(key)
        if entry is None or now > entry[1]:
            self._store[key] = (1, now + window_seconds)
            return 1, window_seconds
        
        count, expiry = entry
        new_count = count + 1
        self._store[key] = (new_count, expiry)
        return new_count, max(1, int(expiry - now))

    def _evict_expired(self) -> None:
        now = time.time()
        expired_keys = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired_keys:
            self._store.pop(k, None)

    def clear(self) -> None:
        self._store.clear()


class CacheManager:
    """
    Unified Cache Manager for Palmora AI.
    Prioritizes Upstash Redis REST API, followed by standard Redis,
    with zero-dependency fallback to InMemoryTTLStore.
    """
    def __init__(self):
        self._memory = InMemoryTTLStore()
        self._upstash_url = (settings.UPSTASH_REDIS_REST_URL or "").strip().rstrip("/")
        self._upstash_token = (settings.UPSTASH_REDIS_REST_TOKEN or "").strip()
        self._is_upstash_configured = bool(self._upstash_url and self._upstash_token)
        self._http_client: Optional[httpx.AsyncClient] = None

    def _get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=3.0)
        return self._http_client

    async def get(self, key: str) -> Optional[Any]:
        """Retrieves a cached item by key from Upstash or in-memory fallback."""
        if self._is_upstash_configured:
            try:
                client = self._get_http_client()
                res = await client.post(
                    f"{self._upstash_url}/",
                    headers={"Authorization": f"Bearer {self._upstash_token}"},
                    json=["GET", key]
                )
                if res.status_code == 200:
                    data = res.json().get("result")
                    if data is not None:
                        try:
                            return json.loads(data)
                        except (json.JSONDecodeError, TypeError):
                            return data
                    return None
            except Exception as e:
                logger.warning(f"Upstash GET failed for key '{key}': {e}. Falling back to in-memory store.")

        # Fallback to in-memory
        return self._memory.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
        """Saves an item with a mandatory TTL (default 15 minutes / 900s)."""
        ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_DEFAULT_TTL_SECONDS
        json_str = json.dumps(value) if not isinstance(value, str) else value

        if self._is_upstash_configured:
            try:
                client = self._get_http_client()
                res = await client.post(
                    f"{self._upstash_url}/",
                    headers={"Authorization": f"Bearer {self._upstash_token}"},
                    json=["SET", key, json_str, "EX", int(ttl)]
                )
                if res.status_code == 200:
                    # Also keep local memory in sync for fast reads
                    self._memory.set(key, value, ttl_seconds=ttl)
                    return True
            except Exception as e:
                logger.warning(f"Upstash SET failed for key '{key}': {e}. Falling back to in-memory store.")

        return self._memory.set(key, value, ttl_seconds=ttl)

    async def delete(self, key: str) -> bool:
        """Purges a key from the cache."""
        success = False
        if self._is_upstash_configured:
            try:
                client = self._get_http_client()
                res = await client.post(
                    f"{self._upstash_url}/",
                    headers={"Authorization": f"Bearer {self._upstash_token}"},
                    json=["DEL", key]
                )
                if res.status_code == 200:
                    success = True
            except Exception as e:
                logger.warning(f"Upstash DEL failed for key '{key}': {e}")

        mem_deleted = self._memory.delete(key)
        return success or mem_deleted

    async def is_rate_limited(
        self,
        key: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> Tuple[bool, int, int]:
        """
        Sliding / fixed window rate limiter.
        Returns:
            (is_blocked: bool, current_count: int, remaining_requests: int)
        """
        rate_key = f"ratelimit:{key}"

        if self._is_upstash_configured:
            try:
                client = self._get_http_client()
                # Pipeline INCR and EXPIRE (NX)
                res = await client.post(
                    f"{self._upstash_url}/pipeline",
                    headers={"Authorization": f"Bearer {self._upstash_token}"},
                    json=[
                        ["INCR", rate_key],
                        ["EXPIRE", rate_key, window_seconds, "NX"]
                    ]
                )
                if res.status_code == 200:
                    results = res.json()
                    curr = results[0].get("result", 1) if isinstance(results, list) and len(results) > 0 else 1
                    is_blocked = curr > max_requests
                    remaining = max(0, max_requests - curr)
                    return is_blocked, curr, remaining
            except Exception as e:
                logger.warning(f"Upstash rate limit pipeline failed for '{rate_key}': {e}. Falling back to memory.")

        # In-memory fallback
        curr, _ = self._memory.increment(rate_key, window_seconds=window_seconds)
        is_blocked = curr > max_requests
        remaining = max(0, max_requests - curr)
        return is_blocked, curr, remaining

    async def close(self) -> None:
        """Clean shutdown of HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    def check_health(self) -> Dict[str, Any]:
        """Reports health and provider status."""
        return {
            "provider": "upstash_redis" if self._is_upstash_configured else "in_memory_ttl_fallback",
            "is_upstash_configured": self._is_upstash_configured,
            "default_ttl_seconds": settings.CACHE_DEFAULT_TTL_SECONDS,
        }


# Singleton application cache instance
cache_client = CacheManager()
