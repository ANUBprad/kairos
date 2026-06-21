from __future__ import annotations

from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from intelligence.api.rate_limit.token_bucket import TokenBucket


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Callable,
        rate_per_minute: int = 100,
        burst: int = 200,
        exclude_paths: set | None = None,
    ) -> None:
        super().__init__(app)
        self._bucket = TokenBucket(capacity=burst, refill_rate=rate_per_minute / 60.0)
        self._exclude_paths = exclude_paths or {"/health", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        path = request.url.path
        if any(path.startswith(ex) for ex in self._exclude_paths):
            return await call_next(request)

        client_key = request.headers.get("X-API-Key") or request.client.host if request.client else "unknown"
        if not self._bucket.consume(client_key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": 1.0},
                headers={"Retry-After": "1"},
            )

        return await call_next(request)
