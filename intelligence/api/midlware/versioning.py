from __future__ import annotations

from typing import Callable, Tuple

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from intelligence.api.versioning import ApiVersion, parse_version_header


class VersioningMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Callable,
        min_version: ApiVersion | None = None,
        max_version: ApiVersion | None = None,
    ) -> None:
        super().__init__(app)
        self._min = min_version or ApiVersion(1, 0, 0)
        self._max = max_version or ApiVersion(2, 0, 0)

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        version_str = request.headers.get("X-API-Version", "1.0.0")
        version = parse_version_header(version_str)
        if version is None:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Invalid X-API-Version header: '{version_str}'. Expected semver (e.g. '1.0.0')."},
            )
        if version < self._min or version > self._max:
            return JSONResponse(
                status_code=400,
                content={
                    "detail": f"Unsupported API version '{version_str}'. Supported range: {self._min} - {self._max}",
                },
            )
        request.state.api_version = version
        return await call_next(request)
