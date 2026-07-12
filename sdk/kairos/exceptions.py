class KairosError(Exception):
    """Base exception for all Kairos client errors."""
    pass


class AuthenticationError(KairosError):
    """Raised when the shared secret is invalid or missing (HTTP 401)."""
    pass


class RateLimitError(KairosError):
    """Raised when the namespace rate limit is exceeded (HTTP 429)."""

    def __init__(self, retry_after: float | None = None):
        self.retry_after = retry_after
        msg = "Rate limit exceeded"
        if retry_after:
            msg += f" — retry after {retry_after}s"
        super().__init__(msg)


class IngestionError(KairosError):
    """Raised when an ingestion job reaches failed status."""

    def __init__(self, job_id: str, detail: str = ""):
        self.job_id = job_id
        super().__init__(f"Ingestion job {job_id} failed: {detail}")


class ConnectionError(KairosError):
    """Raised when the gateway cannot be reached."""
    pass