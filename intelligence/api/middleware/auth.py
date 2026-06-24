from __future__ import annotations

from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from intelligence.api.auth import APIKeyValidator, get_api_key_validator


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Callable,
        exclude_paths: set | None = None,
        validator: APIKeyValidator | None = None,
    ) -> None:
        super().__init__(app)
        self._exclude_paths = exclude_paths or {"/health", "/docs", "/redoc", "/openapi.json"}
        self._validator = validator or get_api_key_validator()

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        path = request.url.path
        if any(path.startswith(ex) for ex in self._exclude_paths):
            return await call_next(request)

        api_key = request.headers.get("X-API-Key") or ""
        if not self._validator.is_valid(api_key):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
