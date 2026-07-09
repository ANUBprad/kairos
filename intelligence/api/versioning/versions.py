from __future__ import annotations

import re
from typing import Optional

_SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


class ApiVersion:
    def __init__(self, major: int, minor: int, patch: int) -> None:
        self.major = major
        self.minor = minor
        self.patch = patch

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    def __repr__(self) -> str:
        return f"ApiVersion({self.major}, {self.minor}, {self.patch})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ApiVersion):
            return NotImplemented
        return (self.major, self.minor, self.patch) == (
            other.major,
            other.minor,
            other.patch,
        )

    def __lt__(self, other: ApiVersion) -> bool:
        return (self.major, self.minor, self.patch) < (
            other.major,
            other.minor,
            other.patch,
        )

    def __le__(self, other: ApiVersion) -> bool:
        return (self.major, self.minor, self.patch) <= (
            other.major,
            other.minor,
            other.patch,
        )

    def __gt__(self, other: ApiVersion) -> bool:
        return (self.major, self.minor, self.patch) > (
            other.major,
            other.minor,
            other.patch,
        )

    def __ge__(self, other: ApiVersion) -> bool:
        return (self.major, self.minor, self.patch) >= (
            other.major,
            other.minor,
            other.patch,
        )

    def __hash__(self) -> int:
        return hash((self.major, self.minor, self.patch))


def parse_version_header(header: str) -> Optional[ApiVersion]:
    match = _SEMVER_RE.match(header.strip())
    if not match:
        return None
    return ApiVersion(int(match.group(1)), int(match.group(2)), int(match.group(3)))


def current_api_version() -> ApiVersion:
    return ApiVersion(1, 0, 0)
