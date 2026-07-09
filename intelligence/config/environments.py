from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict


class EnvironmentProfile(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

    @classmethod
    def from_string(cls, value: str) -> EnvironmentProfile:
        normalized = value.strip().lower()
        for member in cls:
            if member.value == normalized:
                return member
            if member.name.lower() == normalized:
                return member
        return cls.DEVELOPMENT

    @property
    def is_development(self) -> bool:
        return self == EnvironmentProfile.DEVELOPMENT

    @property
    def is_staging(self) -> bool:
        return self == EnvironmentProfile.STAGING

    @property
    def is_production(self) -> bool:
        return self == EnvironmentProfile.PRODUCTION


@dataclass
class ProfileOverrides:
    log_level: str = "INFO"
    api_rate_limit: int = 100
    api_rate_limit_burst: int = 200
    health_check_enabled: bool = True
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout: float = 30.0
    cache_ttl_seconds: int = 300
    deployment: bool = False
    extra: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "log_level": self.log_level,
            "api_rate_limit": self.api_rate_limit,
            "api_rate_limit_burst": self.api_rate_limit_burst,
            "health_check_enabled": self.health_check_enabled,
            "circuit_breaker_failure_threshold": self.circuit_breaker_failure_threshold,
            "circuit_breaker_recovery_timeout": self.circuit_breaker_recovery_timeout,
            "cache_ttl_seconds": self.cache_ttl_seconds,
            "deployment": self.deployment,
            **self.extra,
        }


PROFILE_REGISTRY: Dict[EnvironmentProfile, ProfileOverrides] = {
    EnvironmentProfile.DEVELOPMENT: ProfileOverrides(
        log_level="DEBUG",
        api_rate_limit=1000,
        api_rate_limit_burst=2000,
        cache_ttl_seconds=60,
        circuit_breaker_failure_threshold=10,
        circuit_breaker_recovery_timeout=10.0,
        deployment=False,
        extra={"reload": True, "docs_enabled": True},
    ),
    EnvironmentProfile.STAGING: ProfileOverrides(
        log_level="INFO",
        api_rate_limit=200,
        api_rate_limit_burst=400,
        cache_ttl_seconds=600,
        circuit_breaker_failure_threshold=5,
        circuit_breaker_recovery_timeout=30.0,
        deployment=False,
        extra={"reload": False, "docs_enabled": True},
    ),
    EnvironmentProfile.PRODUCTION: ProfileOverrides(
        log_level="WARNING",
        api_rate_limit=100,
        api_rate_limit_burst=200,
        health_check_enabled=True,
        cache_ttl_seconds=3600,
        circuit_breaker_failure_threshold=3,
        circuit_breaker_recovery_timeout=60.0,
        deployment=True,
        extra={"reload": False, "docs_enabled": False},
    ),
}


def get_environment_profile(env_name: str) -> EnvironmentProfile:
    return EnvironmentProfile.from_string(env_name)


def get_profile_overrides(profile: EnvironmentProfile) -> ProfileOverrides:
    return PROFILE_REGISTRY.get(
        profile, PROFILE_REGISTRY[EnvironmentProfile.DEVELOPMENT]
    )


def apply_profile_overrides(
    env_name: str, config_dict: Dict[str, object]
) -> Dict[str, object]:
    profile = get_environment_profile(env_name)
    overrides = get_profile_overrides(profile)
    result = dict(config_dict)
    for key, value in overrides.to_dict().items():
        if key not in result or result[key] is None:
            result[key] = value
    return result
