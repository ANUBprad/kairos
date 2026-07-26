from __future__ import annotations

import logging
import os
from typing import Optional, Set

from fastapi import HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_ENVIRONMENT = os.environ.get("KAIROS_ENVIRONMENT", "development")


class APIKeyValidator:
    def __init__(self) -> None:
        self._valid_keys: Set[str] = set()
        self._reload()

    def _reload(self) -> None:
        api_key = os.environ.get("KAIROS_API_SECRET", "")
        if api_key:
            self._valid_keys = {api_key}
        else:
            self._valid_keys = set()
            if _ENVIRONMENT != "development":
                logger.warning(
                    "KAIROS_API_SECRET is not set — all API requests will be rejected. "
                    "Set KAIROS_API_SECRET to allow authenticated access."
                )

    def is_valid(self, api_key: str) -> bool:
        if not api_key or not api_key.strip():
            return False

        if not self._valid_keys:
            if _ENVIRONMENT == "development":
                return True
            return False

        # Constant-time comparison using hmac
        import hmac
        key_bytes = api_key.strip().encode("utf-8")

        for valid_key in self._valid_keys:
            valid_bytes = valid_key.encode("utf-8")
            if len(key_bytes) == len(valid_bytes) and hmac.compare_digest(key_bytes, valid_bytes):
                return True

        return False

    def add_key(self, key: str) -> None:
        """Add a valid API key. Used for testing and dynamic key management."""
        if key and key.strip():
            self._valid_keys.add(key.strip())

    def reload(self) -> None:
        self._reload()


_validator_instance: Optional[APIKeyValidator] = None
_bearer_scheme = HTTPBearer(auto_error=False)


def get_api_key_validator() -> APIKeyValidator:
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = APIKeyValidator()
    return _validator_instance


async def verify_api_key(request: Request) -> None:
    validator = get_api_key_validator()
    credentials: Optional[HTTPAuthorizationCredentials] = await _bearer_scheme(request)
    if credentials is None:
        api_key = request.headers.get("X-API-Key")
        if api_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.",
            )
        if not validator.is_valid(api_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid API key.",
            )
        return
    if not validator.is_valid(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )
