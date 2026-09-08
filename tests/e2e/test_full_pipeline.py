"""True end-to-end pipeline validation.

Exercises the actual production request path:

    KairosClient SDK
        -> Go Gateway :8080
            -> gRPC -> Python Intelligence :28080
                -> ChromaDB
                    -> LLM / generation
                        -> response

The test requires running Docker services (chromadb, intelligence, gateway).
It does NOT mock any component.

Environment variables:
    KAIROS_E2E_BASE_URL   Gateway URL (default: http://localhost:8080)
    KAIROS_E2E_SECRET     Auth secret (default: test-secret-e2e)
"""

from __future__ import annotations

import os
import tempfile
import time
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("KAIROS_E2E") != "1",
    reason="End-to-end tests need the Docker stack; set KAIROS_E2E=1 to enable",
)

# ---------------------------------------------------------------------------
# Skip entire module when SDK is not installed
# ---------------------------------------------------------------------------
kairos_client = pytest.importorskip("kairos.client", reason="SDK not installed")
KairosClient = kairos_client.KairosClient

from kairos.exceptions import (  # noqa: E402
    AuthenticationError,
    KairosError,
)

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
GATEWAY_URL = os.environ.get("KAIROS_E2E_BASE_URL", "http://localhost:8080")
AUTH_SECRET = os.environ.get("KAIROS_E2E_SECRET", "test-secret-e2e")

# ---------------------------------------------------------------------------
# Timeouts and polling
# ---------------------------------------------------------------------------
HEALTH_TIMEOUT_S = 10
JOB_POLL_INTERVAL_S = 2
JOB_POLL_TIMEOUT_S = 120
QUERY_TIMEOUT_S = 120
E2E_TOTAL_TIMEOUT_S = 300

# ---------------------------------------------------------------------------
# Deterministic test document
# ---------------------------------------------------------------------------
E2E_MARKER = "KAIROS_E2E_MARKER_2026"
TEST_DOCUMENT = f"""\
The Kairos Adaptive RAG Workbench is a self-hosted retrieval-augmented \
generation platform. It uses a Go gateway that forwards requests over gRPC \
to a Python intelligence engine. The intelligence engine handles document \
ingestion, embedding, retrieval from ChromaDB, query classification, and \
response generation. The system supports three retrieval tiers: simple \
(hybrid BM25 + vector), multi-hop (iterative decomposition), and complex \
(MMR diversity + cross-encoder reranking). The platform includes a Next.js \
portal, Prometheus metrics, and a Streamlit internal dashboard.

{E2E_MARKER}

Key facts: The gateway listens on port 8080. The intelligence gRPC service \
runs on port 28080. ChromaDB stores vector embeddings. The system supports \
PDF and plain text documents. Authentication uses a shared secret passed in \
the X-Secret header. Namespaces isolate document collections via the \
X-Namespace header.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _unique_namespace() -> str:
    return f"kairos-e2e-{uuid.uuid4().hex[:12]}"


def _poll_job(client: KairosClient, job_id: str) -> dict:
    """Poll job status until terminal or timeout.

    Returns the final JobStatusResponse model_dump().
    Raises pytest.fail on timeout or unexpected failure.
    """
    deadline = time.monotonic() + JOB_POLL_TIMEOUT_S
    last_status = None

    while time.monotonic() < deadline:
        try:
            status = client.job_status(job_id)
        except Exception as exc:
            pytest.fail(f"job_status() raised unexpectedly: {exc}")

        last_status = status

        if status.is_complete:
            return status.model_dump()
        if status.is_failed:
            pytest.fail(f"Ingestion job {job_id} failed: {status.error}")

        time.sleep(JOB_POLL_INTERVAL_S)

    pytest.fail(
        f"Ingestion job {job_id} did not complete within "
        f"{JOB_POLL_TIMEOUT_S}s. Last status: {last_status}"
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def e2e_client():
    """Yield a KairosClient pointed at the running gateway."""
    client = KairosClient(
        base_url=GATEWAY_URL,
        secret=AUTH_SECRET,
        namespace=_unique_namespace(),
        timeout=QUERY_TIMEOUT_S,
    )
    yield client
    client.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGatewayHealth:
    """Verify the gateway and full stack are reachable."""

    def test_health_endpoint_returns_full_stack_up(self, e2e_client: KairosClient):
        health = e2e_client.health()
        assert health["gateway_up"] is True
        assert health["intelligence_up"] is True
        assert health["full_stack_up"] is True


class TestIngestion:
    """Ingest a deterministic document and verify job completion."""

    def test_ingest_document_and_wait_for_completion(self, e2e_client: KairosClient):
        namespace = _unique_namespace()
        e2e_client._headers["X-Namespace"] = namespace

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as tmp:
            tmp.write(TEST_DOCUMENT)
            tmp_path = tmp.name

        try:
            job_id = e2e_client.ingest(tmp_path)
            assert job_id, "ingest() must return a non-empty job_id"

            result = _poll_job(e2e_client, job_id)
            assert result["job_status"] == 2  # JobStatus.COMPLETE
            assert result["error"] == ""
        finally:
            os.unlink(tmp_path)


class TestRetrieval:
    """Ingest, then query to prove retrieval + generation work end-to-end."""

    @pytest.fixture(autouse=True)
    def _ingest_document(self, e2e_client: KairosClient):
        """Ingest the test document into a fresh namespace before retrieval tests."""
        self._namespace = _unique_namespace()
        e2e_client._headers["X-Namespace"] = self._namespace

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as tmp:
            tmp.write(TEST_DOCUMENT)
            tmp_path = tmp.name

        try:
            job_id = e2e_client.ingest(tmp_path)
            _poll_job(e2e_client, job_id)
        finally:
            os.unlink(tmp_path)

    def test_query_returns_response_with_marker(self, e2e_client: KairosClient):
        response = e2e_client.query(
            "What is the KAIROS_E2E_MARKER? Reply with the exact marker text."
        )

        # --- Structure validation ---
        assert response.response, "Response must not be empty"
        assert isinstance(response.prompt_tokens, int)
        assert isinstance(response.completion_tokens, int)
        assert isinstance(response.cache_hit, bool)
        assert response.retrieval_details is not None

        # --- Retrieval validation ---
        details = response.retrieval_details
        assert details.retrieval_type is not None
        assert details.top_k > 0

        # --- Content validation: marker must appear in response ---
        assert E2E_MARKER in response.response, (
            f"Expected E2E marker '{E2E_MARKER}' in response. "
            f"Got: {response.response[:500]}"
        )

    def test_query_returns_non_empty_generation(self, e2e_client: KairosClient):
        response = e2e_client.query(
            "Summarize what the Kairos platform does in one sentence."
        )
        assert len(response.response.strip()) > 20, (
            f"Generation too short: {response.response!r}"
        )

    def test_response_model_is_populated(self, e2e_client: KairosClient):
        response = e2e_client.query("Hello, what is this system?")
        assert response.response_model, "response_model must be non-empty"


class TestFailureCases:
    """Minimal failure-path validation (P0 scope)."""

    def test_invalid_auth_returns_401(self):
        client = KairosClient(
            base_url=GATEWAY_URL,
            secret="wrong-secret-12345",
            namespace="kairos-e2e-fail",
        )
        try:
            with pytest.raises(AuthenticationError):
                client.query("test")
        finally:
            client.close()

    def test_empty_query_returns_400(self, e2e_client: KairosClient):
        with pytest.raises(KairosError):
            e2e_client.query("")

    def test_unknown_job_returns_404(self, e2e_client: KairosClient):
        fake_id = str(uuid.uuid4())
        with pytest.raises(KairosError):
            e2e_client.job_status(fake_id)
