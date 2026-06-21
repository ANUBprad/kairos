from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Dict, List, Optional


class SecretProvider(ABC):
    @abstractmethod
    def get(self, key: str) -> Optional[str]:
        ...

    def get_or_raise(self, key: str) -> str:
        value = self.get(key)
        if value is None:
            raise KeyError(f"Secret '{key}' not found")
        return value


class EnvSecretProvider(SecretProvider):
    def get(self, key: str) -> Optional[str]:
        return os.environ.get(key)


class DictSecretProvider(SecretProvider):
    def __init__(self, secrets: Dict[str, str]) -> None:
        self._secrets = dict(secrets)

    def get(self, key: str) -> Optional[str]:
        return self._secrets.get(key)

    def set(self, key: str, value: str) -> None:
        self._secrets[key] = value

    def clear(self) -> None:
        self._secrets.clear()


class ChainedSecretProvider(SecretProvider):
    def __init__(self, providers: List[SecretProvider]) -> None:
        self._providers = list(providers)

    def add_provider(self, provider: SecretProvider) -> None:
        self._providers.append(provider)

    def get(self, key: str) -> Optional[str]:
        for provider in self._providers:
            value = provider.get(key)
            if value is not None:
                return value
        return None


_default_provider: SecretProvider = EnvSecretProvider()


def get_secret_provider() -> SecretProvider:
    return _default_provider


def set_secret_provider(provider: SecretProvider) -> None:
    global _default_provider
    _default_provider = provider
