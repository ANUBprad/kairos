from __future__ import annotations

import time
from typing import Dict

from fastapi import APIRouter

from intelligence.config.settings import get_settings

router = APIRouter()

_start_time = time.monotonic()


class HealthStatus:
    def __init__(self) -> None:
        self._ready = True

    @property
    def is_ready(self) -> bool:
        return self._ready

    def set_ready(self, value: bool) -> None:
        self._ready = value


_health_status = HealthStatus()


def get_health_status() -> HealthStatus:
    return _health_status


@router.get("")
async def health_check() -> Dict[str, object]:
    return {
        "status": "ok",
        "ready": _health_status.is_ready,
        "uptime_seconds": time.monotonic() - _start_time,
        "environment": get_settings().environment,
    }


@router.get("/ready")
async def readiness() -> Dict[str, object]:
    return {
        "ready": _health_status.is_ready,
    }


@router.get("/live")
async def liveness() -> Dict[str, object]:
    return {
        "alive": True,
        "uptime_seconds": time.monotonic() - _start_time,
    }
