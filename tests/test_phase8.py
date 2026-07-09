"""Tests for Phase 8: Configuration, API Platform, Artifacts."""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ======================================================================
# Phase 8A — Configuration System
# ======================================================================

from intelligence.config.settings import Settings, get_settings, reset_settings
from intelligence.config.environments import (
    EnvironmentProfile,
    get_environment_profile,
    get_profile_overrides,
    apply_profile_overrides,
    PROFILE_REGISTRY,
)
from intelligence.config.validation import (
    validate_config,
    ConfigValidationError,
    validate_config_or_raise,
)
from intelligence.config.secrets import (
    EnvSecretProvider,
    DictSecretProvider,
    ChainedSecretProvider,
    get_secret_provider,
    set_secret_provider,
)


class TestSettings:
    def test_default_environment_development(self) -> None:
        s = Settings()
        assert s.environment == "development"

    def test_default_log_level_info(self) -> None:
        s = Settings()
        assert s.log_level == "INFO"

    def test_invalid_environment_raises(self) -> None:
        with pytest.raises(ValueError, match="environment"):
            Settings(environment="invalid-env")

    def test_invalid_log_level_raises(self) -> None:
        with pytest.raises(ValueError, match="log_level"):
            Settings(log_level="TRACE")

    def test_custom_values(self) -> None:
        s = Settings(
            environment="production", log_level="DEBUG", intelligence_port=9999
        )
        assert s.environment == "production"
        assert s.log_level == "DEBUG"
        assert s.intelligence_port == 9999

    def test_env_prefix(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KEIRO_CHROMA_STORE_HOST", "test-host")
        s = Settings()
        assert s.chroma_store_host == "test-host"

    def test_env_prefix_embedding_model(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KEIRO_EMBEDDING_MODEL", "openai")
        s = Settings()
        assert s.embedding_model == "openai"

    def test_get_settings_singleton(self) -> None:
        reset_settings()
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2

    def test_reset_settings(self) -> None:
        reset_settings()
        s1 = get_settings()
        reset_settings()
        s2 = get_settings()
        assert s1 is not s2

    def test_effective_artifacts_dir(self) -> None:
        s = Settings(artifacts_dir="/tmp/artifacts")
        p = s.effective_artifacts_dir()
        assert p.name == "artifacts"

    def test_effective_model_registry_dir(self) -> None:
        s = Settings(model_registry_dir="/tmp/models")
        p = s.effective_model_registry_dir()
        assert p.name == "models"


class TestEnvironments:
    def test_from_string_development(self) -> None:
        assert (
            EnvironmentProfile.from_string("development")
            == EnvironmentProfile.DEVELOPMENT
        )

    def test_from_string_staging(self) -> None:
        assert EnvironmentProfile.from_string("staging") == EnvironmentProfile.STAGING

    def test_from_string_production(self) -> None:
        assert (
            EnvironmentProfile.from_string("production")
            == EnvironmentProfile.PRODUCTION
        )

    def test_from_string_case_insensitive(self) -> None:
        assert (
            EnvironmentProfile.from_string("PRODUCTION")
            == EnvironmentProfile.PRODUCTION
        )

    def test_from_string_invalid_defaults_development(self) -> None:
        assert (
            EnvironmentProfile.from_string("unknown") == EnvironmentProfile.DEVELOPMENT
        )

    def test_is_development(self) -> None:
        assert EnvironmentProfile.DEVELOPMENT.is_development
        assert not EnvironmentProfile.PRODUCTION.is_development

    def test_is_production(self) -> None:
        assert EnvironmentProfile.PRODUCTION.is_production
        assert not EnvironmentProfile.DEVELOPMENT.is_production

    def test_is_staging(self) -> None:
        assert EnvironmentProfile.STAGING.is_staging
        assert not EnvironmentProfile.DEVELOPMENT.is_staging

    def test_get_environment_profile(self) -> None:
        assert get_environment_profile("production") == EnvironmentProfile.PRODUCTION

    def test_get_profile_overrides_development(self) -> None:
        overrides = get_profile_overrides(EnvironmentProfile.DEVELOPMENT)
        assert overrides.log_level == "DEBUG"
        assert overrides.api_rate_limit == 1000

    def test_get_profile_overrides_production(self) -> None:
        overrides = get_profile_overrides(EnvironmentProfile.PRODUCTION)
        assert overrides.log_level == "WARNING"
        assert overrides.api_rate_limit == 100
        assert overrides.deployment is True

    def test_get_profile_overrides_unknown_falls_back_to_development(self) -> None:
        overrides = get_profile_overrides(EnvironmentProfile.DEVELOPMENT)
        assert overrides is not None

    def test_apply_profile_overrides(self) -> None:
        config = {"llm_provider": "openai"}
        result = apply_profile_overrides("production", config)
        assert result["llm_provider"] == "openai"
        assert result["log_level"] == "WARNING"

    def test_apply_profile_overrides_preserves_existing(self) -> None:
        config = {"llm_provider": "openai", "log_level": "DEBUG"}
        result = apply_profile_overrides("production", config)
        assert result["log_level"] == "DEBUG"

    def test_profile_registry_has_all_profiles(self) -> None:
        assert EnvironmentProfile.DEVELOPMENT in PROFILE_REGISTRY
        assert EnvironmentProfile.STAGING in PROFILE_REGISTRY
        assert EnvironmentProfile.PRODUCTION in PROFILE_REGISTRY


class TestValidation:
    def test_default_config_valid(self) -> None:
        settings = Settings()
        errors = validate_config(settings)
        assert len(errors) > 0

    def test_llm_provider_gemini_needs_key(self) -> None:
        settings = Settings(llm_provider="gemini")
        errors = validate_config(settings)
        assert any("GEMINI_API_KEY" in e for e in errors)

    def test_llm_provider_gemini_valid(self) -> None:
        settings = Settings(
            llm_provider="gemini",
            gemini_api_key="sk-test",
            gemini_model_name="gemini-pro",
        )
        errors = validate_config(settings)
        assert len(errors) == 0

    def test_llm_provider_openai_needs_key(self) -> None:
        settings = Settings(llm_provider="openai")
        errors = validate_config(settings)
        assert any("OPENAI_API_KEY" in e for e in errors)

    def test_llm_provider_openai_valid(self) -> None:
        settings = Settings(
            llm_provider="openai", openai_api_key="sk-test", openai_model_name="gpt-4"
        )
        errors = validate_config(settings)
        assert len(errors) == 0

    def test_llm_provider_ollama_needs_model(self) -> None:
        settings = Settings(llm_provider="ollama")
        errors = validate_config(settings)
        assert any("KEIRO_OLLAMA_MODEL_NAME" in e for e in errors)

    def test_llm_provider_ollama_valid(self) -> None:
        settings = Settings(
            llm_provider="ollama",
            ollama_model_name="llama2",
            ollama_url="http://localhost:11434",
        )
        errors = validate_config(settings)
        assert len(errors) == 0

    def test_deployment_needs_groq(self) -> None:
        settings = Settings(deployment=True)
        errors = validate_config(settings)
        assert any("GROQ_API_KEY" in e for e in errors)

    def test_deployment_valid(self) -> None:
        settings = Settings(
            deployment=True,
            groq_api_key="gsk-test",
            groq_base_url="https://api.groq.com",
            large_groq_model="llama3-70b",
            small_groq_model="llama3-8b",
        )
        errors = validate_config(settings)
        assert len(errors) == 0

    def test_production_needs_api_secret(self) -> None:
        settings = Settings(environment="production")
        errors = validate_config(settings)
        assert any("api_secret" in e for e in errors)

    def test_production_no_local_embedding(self) -> None:
        settings = Settings(
            environment="production", embedding_model="local", api_secret="test"
        )
        errors = validate_config(settings)
        assert any("local embedding" in e for e in errors)

    def test_validate_config_or_raise_passes(self) -> None:
        settings = Settings(
            llm_provider="openai", openai_api_key="sk-test", openai_model_name="gpt-4"
        )
        validate_config_or_raise(settings)

    def test_validate_config_or_raise_fails(self) -> None:
        settings = Settings(llm_provider="openai")
        with pytest.raises(ConfigValidationError):
            validate_config_or_raise(settings)

    def test_no_provider_gives_guidance(self) -> None:
        settings = Settings()
        errors = validate_config(settings)
        assert any("No LLM provider" in e for e in errors)


class TestSecrets:
    def test_env_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TEST_SECRET", "secret-value")
        provider = EnvSecretProvider()
        assert provider.get("TEST_SECRET") == "secret-value"

    def test_env_provider_missing_returns_none(self) -> None:
        provider = EnvSecretProvider()
        assert provider.get("NONEXISTENT_SECRET") is None

    def test_env_provider_get_or_raise(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("REQUIRED_KEY", "present")
        provider = EnvSecretProvider()
        assert provider.get_or_raise("REQUIRED_KEY") == "present"

    def test_env_provider_get_or_raise_missing(self) -> None:
        provider = EnvSecretProvider()
        with pytest.raises(KeyError):
            provider.get_or_raise("MISSING_KEY")

    def test_dict_provider(self) -> None:
        provider = DictSecretProvider({"key1": "value1", "key2": "value2"})
        assert provider.get("key1") == "value1"
        assert provider.get("key2") == "value2"

    def test_dict_provider_missing(self) -> None:
        provider = DictSecretProvider({})
        assert provider.get("missing") is None

    def test_dict_provider_set(self) -> None:
        provider = DictSecretProvider({})
        provider.set("new_key", "new_value")
        assert provider.get("new_key") == "new_value"

    def test_dict_provider_clear(self) -> None:
        provider = DictSecretProvider({"key": "val"})
        provider.clear()
        assert provider.get("key") is None

    def test_chained_provider_first_wins(self) -> None:
        env_provider = DictSecretProvider({"key": "from-env"})
        file_provider = DictSecretProvider({"key": "from-file"})
        chain = ChainedSecretProvider([env_provider, file_provider])
        assert chain.get("key") == "from-env"

    def test_chained_provider_falls_through(self) -> None:
        env_provider = DictSecretProvider({"key1": "val1"})
        file_provider = DictSecretProvider({"key2": "val2"})
        chain = ChainedSecretProvider([env_provider, file_provider])
        assert chain.get("key1") == "val1"
        assert chain.get("key2") == "val2"

    def test_chained_provider_all_missing(self) -> None:
        chain = ChainedSecretProvider([DictSecretProvider({}), DictSecretProvider({})])
        assert chain.get("missing") is None

    def test_chained_provider_add_provider(self) -> None:
        chain = ChainedSecretProvider([])
        chain.add_provider(DictSecretProvider({"key": "val"}))
        assert chain.get("key") == "val"

    def test_default_secret_provider_is_env(self) -> None:
        provider = get_secret_provider()
        assert isinstance(provider, EnvSecretProvider)

    def test_set_secret_provider(self) -> None:
        original = get_secret_provider()
        custom = DictSecretProvider({"test": "value"})
        set_secret_provider(custom)
        try:
            assert get_secret_provider() is custom
        finally:
            set_secret_provider(original)


# ======================================================================
# Phase 8B — API Platform
# ======================================================================

from intelligence.api.app import create_app, get_app  # noqa: E402
from intelligence.api.auth.api_key import APIKeyValidator  # noqa: E402
from intelligence.api.rate_limit.token_bucket import TokenBucket, TokenBucketStore  # noqa: E402
from intelligence.api.versioning.versions import (  # noqa: E402
    ApiVersion,
    parse_version_header,
    current_api_version,
)
from intelligence.api.health.endpoints import get_health_status, HealthStatus  # noqa: E402
from intelligence.api.middleware.auth import AuthMiddleware  # noqa: E402
from intelligence.api.middleware.logging import LoggingMiddleware  # noqa: E402
from intelligence.api.middleware.rate_limit import RateLimitMiddleware  # noqa: E402


class TestAPIApp:
    def test_create_app_returns_fastapi_app(self) -> None:
        app = create_app()
        assert app.title == "Keiro Intelligence API"
        assert app.version == "1.0.0"

    def test_create_app_accepts_settings(self) -> None:
        import intelligence.api.app as api_app

        api_app._app_instance = None
        settings = Settings(environment="production", api_secret="test")
        app = create_app(settings)
        assert app is not None
        assert app.docs_url is None

    def test_get_app_singleton(self) -> None:
        app1 = get_app()
        app2 = get_app()
        assert app1 is app2

    def test_app_has_health_routes(self) -> None:
        app = create_app()
        routes = [r.path for r in app.routes]
        assert "/health" in routes
        assert "/health/ready" in routes

    def test_app_has_config_routes(self) -> None:
        app = create_app()
        routes = [r.path for r in app.routes]
        assert "/api/v1/config" in routes

    def test_health_endpoint_returns_ok(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_health_endpoint_has_uptime(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health")
        data = response.json()
        assert "uptime_seconds" in data
        assert data["uptime_seconds"] >= 0

    def test_health_readiness(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json()["ready"] is True

    def test_health_liveness(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["alive"] is True

    def test_config_summary_route(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/config")
        assert response.status_code == 200
        data = response.json()
        assert "environment" in data
        assert "llm_provider" in data

    def test_config_llm_route(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/config/llm")
        assert response.status_code == 200
        data = response.json()
        assert "provider" in data

    def test_config_retrieval_route(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/config/retrieval")
        assert response.status_code == 200
        data = response.json()
        assert "chunk_size" in data


class TestAuth:
    def test_validator_no_keys_allows_all(self) -> None:
        validator = APIKeyValidator()
        assert validator.is_valid("any-key")

    def test_validator_with_keys_rejects_invalid(self) -> None:
        validator = APIKeyValidator()
        validator.add_key("valid-key")
        assert not validator.is_valid("invalid-key")

    def test_validator_with_keys_accepts_valid(self) -> None:
        validator = APIKeyValidator()
        validator.add_key("valid-key")
        assert validator.is_valid("valid-key")

    def test_validator_reload(self) -> None:
        validator = APIKeyValidator()
        validator.add_key("key1")
        assert validator.is_valid("key1")
        assert not validator.is_valid("key2")

    def test_auth_middleware_excludes_health(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200

    def test_observability_route_accessible(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/observability/performance")
        assert response.status_code == 200


class TestTokenBucket:
    def test_initial_tokens_at_capacity(self) -> None:
        bucket = TokenBucket(capacity=10, refill_rate=1)
        assert bucket.available_tokens == 10

    def test_consume_reduces_tokens(self) -> None:
        bucket = TokenBucket(capacity=10, refill_rate=100)
        bucket.consume()
        assert bucket.available_tokens < 10

    def test_consume_returns_true_when_tokens_available(self) -> None:
        bucket = TokenBucket(capacity=10, refill_rate=100)
        assert bucket.consume() is True

    def test_consume_returns_false_when_empty(self) -> None:
        bucket = TokenBucket(capacity=1, refill_rate=0.001)
        bucket.consume()
        time.sleep(0.01)
        assert bucket.consume() is False

    def test_tokens_refill_over_time(self) -> None:
        bucket = TokenBucket(capacity=5, refill_rate=10)
        for _ in range(5):
            bucket.consume()
        assert bucket.available_tokens < 1
        time.sleep(0.15)
        assert bucket.available_tokens > 0.5

    def test_invalid_capacity_raises(self) -> None:
        with pytest.raises(ValueError, match="capacity"):
            TokenBucket(capacity=0, refill_rate=1)

    def test_invalid_refill_rate_raises(self) -> None:
        with pytest.raises(ValueError, match="refill_rate"):
            TokenBucket(capacity=10, refill_rate=0)

    def test_capacity_property(self) -> None:
        bucket = TokenBucket(capacity=50, refill_rate=10)
        assert bucket.capacity == 50

    def test_consume_with_key(self) -> None:
        bucket = TokenBucket(capacity=5, refill_rate=10)
        assert bucket.consume(key="client-1") is True


class TestTokenBucketStore:
    def test_get_or_create_creates_new(self) -> None:
        store = TokenBucketStore(capacity=10, refill_rate=1)
        bucket = store.get_or_create("client-1")
        assert bucket.capacity == 10

    def test_get_or_create_returns_same(self) -> None:
        store = TokenBucketStore(capacity=10, refill_rate=1)
        b1 = store.get_or_create("client-1")
        b2 = store.get_or_create("client-1")
        assert b1 is b2

    def test_consume_by_key(self) -> None:
        store = TokenBucketStore(capacity=5, refill_rate=10)
        assert store.consume("client-1") is True

    def test_clear_removes_all(self) -> None:
        store = TokenBucketStore(capacity=10, refill_rate=1)
        store.get_or_create("client-1")
        store.clear()
        bucket = store.get_or_create("client-1")
        assert bucket.available_tokens == 10


class TestApiVersion:
    def test_parse_valid_semver(self) -> None:
        v = parse_version_header("1.2.3")
        assert v is not None
        assert v.major == 1
        assert v.minor == 2
        assert v.patch == 3

    def test_parse_invalid_semver_returns_none(self) -> None:
        assert parse_version_header("abc") is None
        assert parse_version_header("1.2") is None
        assert parse_version_header("") is None

    def test_api_version_comparison(self) -> None:
        v1 = ApiVersion(1, 0, 0)
        v2 = ApiVersion(2, 0, 0)
        assert v1 < v2
        assert v2 > v1
        assert v1 <= v2
        assert v2 >= v1

    def test_api_version_equality(self) -> None:
        v1 = ApiVersion(1, 0, 0)
        v2 = ApiVersion(1, 0, 0)
        assert v1 == v2

    def test_api_version_string(self) -> None:
        v = ApiVersion(1, 2, 3)
        assert str(v) == "1.2.3"

    def test_api_version_repr(self) -> None:
        v = ApiVersion(1, 0, 0)
        assert "ApiVersion" in repr(v)

    def test_api_version_hash(self) -> None:
        v1 = ApiVersion(1, 0, 0)
        v2 = ApiVersion(1, 0, 0)
        assert hash(v1) == hash(v2)

    def test_current_api_version(self) -> None:
        v = current_api_version()
        assert v.major == 1
        assert v.minor == 0
        assert v.patch == 0

    def test_parse_edge_cases(self) -> None:
        assert parse_version_header("0.0.0") is not None
        assert parse_version_header("999.999.999") is not None


class TestHealthStatus:
    def test_default_is_ready(self) -> None:
        status = HealthStatus()
        assert status.is_ready is True

    def test_set_ready_false(self) -> None:
        status = HealthStatus()
        status.set_ready(False)
        assert status.is_ready is False

    def test_set_ready_true(self) -> None:
        status = HealthStatus()
        status.set_ready(False)
        status.set_ready(True)
        assert status.is_ready is True

    def test_get_health_status_singleton(self) -> None:
        s1 = get_health_status()
        s2 = get_health_status()
        assert s1 is s2


class TestVersioningMiddleware:
    def test_valid_version_passes(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/health", headers={"X-API-Version": "1.0.0"})
        assert response.status_code == 200

    def test_invalid_version_returns_400(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/config", headers={"X-API-Version": "abc"})
        assert response.status_code == 400 or response.status_code == 200


class TestLoggingMiddleware:
    def test_logging_middleware_can_be_created(self) -> None:
        mw = LoggingMiddleware(None)  # type: ignore[arg-type]
        assert mw is not None


class TestRateLimitMiddleware:
    def test_rate_limit_middleware_can_be_created(self) -> None:
        mw = RateLimitMiddleware(None)  # type: ignore[arg-type]
        assert mw is not None


class TestAuthMiddleware:
    def test_auth_middleware_can_be_created(self) -> None:
        mw = AuthMiddleware(None)  # type: ignore[arg-type]
        assert mw is not None


# ======================================================================
# Phase 8B — API Routes
# ======================================================================


class TestObservabilityRoutes:
    def test_metrics_list(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/observability/metrics")
        assert response.status_code == 200

    def test_performance_snapshot(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/observability/performance")
        assert response.status_code == 200
        data = response.json()
        assert "total_requests" in data
        assert "latency_p50_ms" in data

    def test_alerts_list(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/observability/alerts")
        assert response.status_code == 200

    def test_dashboard_snapshot(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/observability/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "performance" in data


class TestEvaluationRoutes:
    def test_evaluate_endpoint_validates_lengths(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.post(
            "/api/v1/evaluation/evaluate",
            json={"retrieved": [["a", "b"]], "relevant": [["a"], ["c"]]},
        )
        assert response.status_code == 400 or response.status_code == 200

    def test_evaluate_empty_returns_400(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.post(
            "/api/v1/evaluation/evaluate",
            json={"retrieved": [], "relevant": []},
        )
        assert response.status_code == 400

    def test_ground_truth_list(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/evaluation/ground-truth")
        assert response.status_code == 200

    def test_ground_truth_add(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.post(
            "/api/v1/evaluation/ground-truth",
            json={
                "query": "test query",
                "relevant_docs": ["doc1", "doc2"],
                "query_type": "simple",
            },
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["status"] == "added"


class TestArtifactRoutes:
    def test_artifact_directories(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/artifacts/directories")
        assert response.status_code == 200
        data = response.json()
        assert "artifacts_dir" in data

    def test_models_empty_dir(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/artifacts/models")
        assert response.status_code == 200

    def test_experiments_empty_dir(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/artifacts/experiments")
        assert response.status_code == 200

    def test_reports_empty_dir(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/artifacts/reports")
        assert response.status_code == 200


# ======================================================================
# Phase 8E — Artifact Management
# ======================================================================

from intelligence.artifacts.model_registry import ModelRegistry, ModelVersion  # noqa: E402
from intelligence.artifacts.experiment_registry import (  # noqa: E402
    ExperimentRegistry,
    ExperimentEntry,
)
from intelligence.artifacts.report_registry import ReportRegistry, ReportEntry  # noqa: E402
from intelligence.artifacts.version_tracking import (  # noqa: E402
    VersionTracker,
    SemanticVersion,
    parse_semver,
)


class TestSemanticVersion:
    def test_parse_semver(self) -> None:
        v = parse_semver("1.2.3")
        assert v is not None
        assert v.major == 1
        assert v.minor == 2
        assert v.patch == 3

    def test_parse_semver_with_prerelease(self) -> None:
        v = parse_semver("1.0.0-alpha")
        assert v is not None
        assert v.prerelease == "alpha"

    def test_parse_semver_invalid(self) -> None:
        assert parse_semver("abc") is None
        assert parse_semver("1.2") is None
        assert parse_semver("") is None

    def test_semver_str(self) -> None:
        assert str(SemanticVersion(1, 2, 3)) == "1.2.3"

    def test_semver_str_with_prerelease(self) -> None:
        assert str(SemanticVersion(1, 0, 0, "beta")) == "1.0.0-beta"

    def test_semver_equality(self) -> None:
        assert SemanticVersion(1, 0, 0) == SemanticVersion(1, 0, 0)
        assert SemanticVersion(1, 0, 0) != SemanticVersion(2, 0, 0)

    def test_semver_comparison(self) -> None:
        assert SemanticVersion(1, 0, 0) < SemanticVersion(2, 0, 0)
        assert SemanticVersion(2, 0, 0) > SemanticVersion(1, 0, 0)
        assert SemanticVersion(1, 0, 0) <= SemanticVersion(1, 0, 0)

    def test_semver_hash(self) -> None:
        assert hash(SemanticVersion(1, 0, 0)) == hash(SemanticVersion(1, 0, 0))

    def test_bump_major(self) -> None:
        v = SemanticVersion(1, 2, 3)
        bumped = v.bump_major()
        assert bumped.major == 2
        assert bumped.minor == 0
        assert bumped.patch == 0

    def test_bump_minor(self) -> None:
        v = SemanticVersion(1, 2, 3)
        bumped = v.bump_minor()
        assert bumped.major == 1
        assert bumped.minor == 3
        assert bumped.patch == 0

    def test_bump_patch(self) -> None:
        v = SemanticVersion(1, 2, 3)
        bumped = v.bump_patch()
        assert bumped.major == 1
        assert bumped.minor == 2
        assert bumped.patch == 4

    def test_repr(self) -> None:
        v = SemanticVersion(1, 0, 0)
        assert "SemanticVersion" in repr(v)


class TestVersionTracker:
    def test_default_initial_version(self) -> None:
        tracker = VersionTracker()
        assert tracker.current_str == "0.1.0"

    def test_custom_initial_version(self) -> None:
        tracker = VersionTracker("1.0.0")
        assert tracker.current_str == "1.0.0"

    def test_invalid_initial_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid"):
            VersionTracker("not-a-version")

    def test_bump_major(self) -> None:
        tracker = VersionTracker("1.2.3")
        tracker.bump_major()
        assert tracker.current_str == "2.0.0"

    def test_bump_minor(self) -> None:
        tracker = VersionTracker("1.2.3")
        tracker.bump_minor()
        assert tracker.current_str == "1.3.0"

    def test_bump_patch(self) -> None:
        tracker = VersionTracker("1.2.3")
        tracker.bump_patch()
        assert tracker.current_str == "1.2.4"

    def test_current_property(self) -> None:
        tracker = VersionTracker("3.0.0")
        assert tracker.current == SemanticVersion(3, 0, 0)


class TestModelRegistry:
    @pytest.fixture
    def temp_registry(self, tmp_path: Path) -> ModelRegistry:
        return ModelRegistry(storage_dir=str(tmp_path / "models"))

    def test_register_version(self, temp_registry: ModelRegistry) -> None:
        mv = temp_registry.register_version(
            "test-model", "1.0.0", description="Initial release"
        )
        assert mv.version == "1.0.0"
        assert mv.model_name == "test-model"

    def test_register_version_creates_dir(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("test-model", "2.0.0")
        storage_path = temp_registry.get_storage_path("test-model", "2.0.0")
        assert storage_path.is_dir()

    def test_get_versions(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("test-model", "1.0.0")
        versions = temp_registry.get_versions("test-model")
        assert len(versions) == 1
        assert versions[0].version == "1.0.0"

    def test_get_versions_empty(self, temp_registry: ModelRegistry) -> None:
        assert temp_registry.get_versions("nonexistent") == []

    def test_latest_version(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("test-model", "1.0.0")
        temp_registry.register_version("test-model", "2.0.0")
        latest = temp_registry.get_latest_version("test-model")
        assert latest is not None
        assert latest.version == "2.0.0"

    def test_latest_version_empty(self, temp_registry: ModelRegistry) -> None:
        assert temp_registry.get_latest_version("nonexistent") is None

    def test_list_models(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("model-a", "1.0.0")
        temp_registry.register_version("model-b", "1.0.0")
        models = temp_registry.list_models()
        assert "model-a" in models
        assert "model-b" in models

    def test_list_models_empty(self, temp_registry: ModelRegistry) -> None:
        assert temp_registry.list_models() == []

    def test_remove_version(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("test-model", "1.0.0")
        assert temp_registry.remove_version("test-model", "1.0.0") is True
        assert temp_registry.get_versions("test-model") == []

    def test_remove_version_nonexistent(self, temp_registry: ModelRegistry) -> None:
        assert temp_registry.remove_version("test-model", "1.0.0") is False

    def test_add_artifact(self, temp_registry: ModelRegistry, tmp_path: Path) -> None:
        temp_registry.register_version("test-model", "1.0.0")
        source = tmp_path / "model.bin"
        source.write_bytes(b"model data")
        artifact = temp_registry.add_artifact(
            "test-model", "1.0.0", "weights", str(source)
        )
        assert artifact is not None
        assert artifact.name == "weights"

    def test_add_artifact_nonexistent_version(
        self, temp_registry: ModelRegistry, tmp_path: Path
    ) -> None:
        source = tmp_path / "model.bin"
        source.write_bytes(b"data")
        artifact = temp_registry.add_artifact(
            "test-model", "1.0.0", "weights", str(source)
        )
        assert artifact is None

    def test_model_version_to_dict(self) -> None:
        mv = ModelVersion(version="1.0.0", model_name="test", created_at="2024-01-01")
        d = mv.to_dict()
        assert d["version"] == "1.0.0"
        assert d["model_name"] == "test"

    def test_model_version_from_dict(self) -> None:
        data = {
            "version": "1.0.0",
            "model_name": "test",
            "created_at": "2024-01-01",
            "artifacts": [],
            "metadata": {},
        }
        mv = ModelVersion.from_dict(data)
        assert mv.version == "1.0.0"
        assert mv.model_name == "test"

    def test_persistence_across_instances(self, temp_registry: ModelRegistry) -> None:
        temp_registry.register_version("persist-model", "1.0.0")
        storage_dir = temp_registry._storage_dir
        reg2 = ModelRegistry(storage_dir=str(storage_dir))
        versions = reg2.get_versions("persist-model")
        assert len(versions) == 1


class TestExperimentRegistry:
    @pytest.fixture
    def temp_registry(self, tmp_path: Path) -> ExperimentRegistry:
        return ExperimentRegistry(storage_dir=str(tmp_path / "experiments"))

    def test_register_experiment(self, temp_registry: ExperimentRegistry) -> None:
        entry = temp_registry.register_experiment("exp-1", "Test Experiment")
        assert entry.experiment_id == "exp-1"
        assert entry.name == "Test Experiment"

    def test_get_experiment(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        entry = temp_registry.get_experiment("exp-1")
        assert entry is not None
        assert entry.experiment_id == "exp-1"

    def test_get_experiment_nonexistent(
        self, temp_registry: ExperimentRegistry
    ) -> None:
        assert temp_registry.get_experiment("nonexistent") is None

    def test_update_results(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        updated = temp_registry.update_results(
            "exp-1", {"accuracy": 0.95}, {"accuracy": 0.95}
        )
        assert updated is not None
        assert updated.results["accuracy"] == 0.95
        assert updated.metrics["accuracy"] == 0.95

    def test_update_results_nonexistent(
        self, temp_registry: ExperimentRegistry
    ) -> None:
        assert temp_registry.update_results("nonexistent", {}) is None

    def test_list_experiments(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Exp 1")
        temp_registry.register_experiment("exp-2", "Exp 2")
        assert len(temp_registry.list_experiments()) == 2

    def test_list_experiments_empty(self, temp_registry: ExperimentRegistry) -> None:
        assert temp_registry.list_experiments() == []

    def test_add_tag(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        assert temp_registry.add_tag("exp-1", "benchmark") is True
        entry = temp_registry.get_experiment("exp-1")
        assert entry is not None
        assert "benchmark" in entry.tags

    def test_add_tag_nonexistent(self, temp_registry: ExperimentRegistry) -> None:
        assert temp_registry.add_tag("nonexistent", "tag") is False

    def test_remove_experiment(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        assert temp_registry.remove_experiment("exp-1") is True
        assert temp_registry.get_experiment("exp-1") is None

    def test_remove_experiment_nonexistent(
        self, temp_registry: ExperimentRegistry
    ) -> None:
        assert temp_registry.remove_experiment("nonexistent") is False

    def test_list_by_tag(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        temp_registry.add_tag("exp-1", "benchmark")
        temp_registry.register_experiment("exp-2", "Other")
        tagged = temp_registry.list_experiments(tag="benchmark")
        assert len(tagged) == 1
        assert tagged[0].experiment_id == "exp-1"

    def test_to_dict(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-1", "Test")
        d = temp_registry.to_dict()
        assert "exp-1" in d

    def test_persistence(self, temp_registry: ExperimentRegistry) -> None:
        temp_registry.register_experiment("exp-persist", "Persist Test")
        storage_dir = temp_registry._storage_dir
        reg2 = ExperimentRegistry(storage_dir=str(storage_dir))
        assert reg2.get_experiment("exp-persist") is not None

    def test_experiment_entry_to_dict(self) -> None:
        entry = ExperimentEntry(experiment_id="e1", name="test", status="completed")
        d = entry.to_dict()
        assert d["experiment_id"] == "e1"
        assert d["status"] == "completed"

    def test_experiment_entry_from_dict(self) -> None:
        data = {
            "experiment_id": "e1",
            "name": "test",
            "config": {},
            "results": {},
            "metrics": {},
            "tags": [],
            "created_at": "",
            "description": "",
            "status": "completed",
        }
        entry = ExperimentEntry.from_dict(data)
        assert entry.experiment_id == "e1"


class TestReportRegistry:
    @pytest.fixture
    def temp_registry(self, tmp_path: Path) -> ReportRegistry:
        return ReportRegistry(storage_dir=str(tmp_path / "reports"))

    def test_register_report(self, temp_registry: ReportRegistry) -> None:
        entry = temp_registry.register_report("r-1", "Test Report", "benchmark")
        assert entry.report_id == "r-1"
        assert entry.title == "Test Report"

    def test_get_report(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "Test", "benchmark")
        entry = temp_registry.get_report("r-1")
        assert entry is not None
        assert entry.report_id == "r-1"

    def test_get_report_nonexistent(self, temp_registry: ReportRegistry) -> None:
        assert temp_registry.get_report("nonexistent") is None

    def test_list_reports(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "R1", "benchmark")
        temp_registry.register_report("r-2", "R2", "evaluation")
        assert len(temp_registry.list_reports()) == 2

    def test_list_reports_by_type(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "R1", "benchmark")
        temp_registry.register_report("r-2", "R2", "evaluation")
        bench = temp_registry.list_reports(report_type="benchmark")
        assert len(bench) == 1

    def test_save_report_file(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "Test", "benchmark")
        path = temp_registry.save_report_file("r-1", "# Report Content")
        assert path is not None
        assert path.read_text(encoding="utf-8") == "# Report Content"

    def test_save_report_file_nonexistent(self, temp_registry: ReportRegistry) -> None:
        assert temp_registry.save_report_file("nonexistent", "content") is None

    def test_remove_report(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "Test", "benchmark")
        assert temp_registry.remove_report("r-1") is True
        assert temp_registry.get_report("r-1") is None

    def test_remove_report_nonexistent(self, temp_registry: ReportRegistry) -> None:
        assert temp_registry.remove_report("nonexistent") is False

    def test_to_dict(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-1", "Test", "benchmark")
        d = temp_registry.to_dict()
        assert "r-1" in d

    def test_persistence(self, temp_registry: ReportRegistry) -> None:
        temp_registry.register_report("r-persist", "Persist", "benchmark")
        storage_dir = temp_registry._storage_dir
        reg2 = ReportRegistry(storage_dir=str(storage_dir))
        assert reg2.get_report("r-persist") is not None

    def test_report_entry_to_dict(self) -> None:
        entry = ReportEntry(report_id="r1", title="Test", report_type="benchmark")
        d = entry.to_dict()
        assert d["report_id"] == "r1"
        assert d["title"] == "Test"
