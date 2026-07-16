from __future__ import annotations

import os
import logging
from typing import Optional, Set

from fastapi import HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from intelligence.config.secrets import SecretProvider, get_secret_provider

logger = logging.getLogger(__name__)

_ENVIRONMENT = os.environ.get("KAIROS_ENVIRONMENT", "development")


class APIKeyValidator:
    def __init__(self, secret_provider: Optional[SecretProvider] = None) -> None:
        self._provider = secret_provider or get_secret_provider()
        self._valid_keys: Set[str] = set()
        self._reload()

    def _reload(self) -> None:
        api_key = self._provider.get("KAIROS_API_SECRET")
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
        if not self._valid_keys:
            if _ENVIRONMENT == "development":
                return True
            return False
        return api_key in self._valid_keys

    def add_key(self, key: str) -> None:
        self._valid_keys.add(key)

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
