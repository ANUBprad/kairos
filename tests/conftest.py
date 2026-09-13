"""Shared test configuration and fixtures."""

from __future__ import annotations

from pathlib import Path
import sys

import pytest

from intelligence.config.settings import Settings

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def _hermetic_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stop the repo .env from bleeding into Settings() during tests.

    Settings reads ``.env`` on construction, so a developer's local .env (LLM
    keys, api_secret, provider choice) would otherwise silently change what
    tests observe. Env vars set via monkeypatch/patch.dict and explicit
    Settings(...) kwargs still work; only the dotenv file source is dropped,
    matching CI where no .env exists.
    """

    def _no_dotenv(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return init_settings, env_settings, file_secret_settings

    monkeypatch.setattr(Settings, "settings_customise_sources", classmethod(_no_dotenv))
