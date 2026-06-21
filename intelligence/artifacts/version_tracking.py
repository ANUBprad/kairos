from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


_SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$")


@dataclass
class SemanticVersion:
    major: int
    minor: int
    patch: int
    prerelease: str = ""

    def __str__(self) -> str:
        base = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            return f"{base}-{self.prerelease}"
        return base

    def __repr__(self) -> str:
        return f"SemanticVersion({self.major}, {self.minor}, {self.patch}, '{self.prerelease}')"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, SemanticVersion):
            return NotImplemented
        return (self.major, self.minor, self.patch, self.prerelease) == (
            other.major, other.minor, other.patch, other.prerelease,
        )

    def __lt__(self, other: SemanticVersion) -> bool:
        return (self.major, self.minor, self.patch) < (other.major, other.minor, other.patch)

    def __le__(self, other: SemanticVersion) -> bool:
        return (self.major, self.minor, self.patch) <= (other.major, other.minor, other.patch)

    def __gt__(self, other: SemanticVersion) -> bool:
        return (self.major, self.minor, self.patch) > (other.major, other.minor, other.patch)

    def __ge__(self, other: SemanticVersion) -> bool:
        return (self.major, self.minor, self.patch) >= (other.major, other.minor, other.patch)

    def __hash__(self) -> int:
        return hash((self.major, self.minor, self.patch, self.prerelease))

    def bump_major(self) -> SemanticVersion:
        return SemanticVersion(self.major + 1, 0, 0)

    def bump_minor(self) -> SemanticVersion:
        return SemanticVersion(self.major, self.minor + 1, 0)

    def bump_patch(self) -> SemanticVersion:
        return SemanticVersion(self.major, self.minor, self.patch + 1)


def parse_semver(text: str) -> Optional[SemanticVersion]:
    match = _SEMVER_RE.match(text.strip())
    if not match:
        return None
    return SemanticVersion(
        major=int(match.group(1)),
        minor=int(match.group(2)),
        patch=int(match.group(3)),
        prerelease=match.group(4) or "",
    )


class VersionTracker:
    def __init__(self, initial_version: str = "0.1.0") -> None:
        parsed = parse_semver(initial_version)
        if parsed is None:
            raise ValueError(f"Invalid initial version string: {initial_version}")
        self._version = parsed

    @property
    def current(self) -> SemanticVersion:
        return self._version

    @property
    def current_str(self) -> str:
        return str(self._version)

    def bump_major(self) -> SemanticVersion:
        self._version = self._version.bump_major()
        return self._version

    def bump_minor(self) -> SemanticVersion:
        self._version = self._version.bump_minor()
        return self._version

    def bump_patch(self) -> SemanticVersion:
        self._version = self._version.bump_patch()
        return self._version
