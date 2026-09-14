"""gRPC service authentication for the Intelligence boundary.

Every protected RPC must present the shared service credential (``KAIROS_SECRET``)
as ``x-api-key`` request metadata. The gateway attaches this credential to every
call it makes; any process that can reach the gRPC port but does not hold the
secret cannot invoke a protected method. The gRPC health service
(``grpc.health.v1.Health``) stays open for orchestrator and load-balancer probes.

Fails closed: with no credential configured, every protected call is rejected
with ``UNAUTHENTICATED``.
"""

from __future__ import annotations

import hmac
from typing import Optional

import grpc

_HEALTH_SERVICE_PREFIX = "/grpc.health.v1.Health/"


class AuthInterceptor(grpc.ServerInterceptor):
    """Rejects RPCs that do not present the configured service credential.

    Runs before the handler: a denied call is aborted with
    ``UNAUTHENTICATED`` and the business-logic handler is never invoked.
    Identity metadata (``x-user-id``, ``x-org-id``, ``x-role``, ...) is never
    consumed — the credential is the only accepted proof.
    """

    def __init__(self, secret: Optional[str]) -> None:
        self._secret = secret or ""

    def _authenticated(self, provided: str) -> bool:
        if not self._secret or not provided:
            return False
        expected = self._secret.encode("utf-8")
        supplied = provided.encode("utf-8")
        return len(expected) == len(supplied) and hmac.compare_digest(
            expected, supplied
        )

    def intercept_service(self, continuation, handler_call_details):
        method = handler_call_details.method
        if method.startswith(_HEALTH_SERVICE_PREFIX):
            return continuation(handler_call_details)

        metadata = dict(handler_call_details.invocation_metadata)
        if self._authenticated(metadata.get("x-api-key", "")):
            return continuation(handler_call_details)

        def deny(request, context):
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                "missing or invalid service credential",
            )

        # Every protected RPC in this service is unary-unary, so a unary-unary
        # denial covers them all. A denied handler never reaches the servicer.
        return grpc.unary_unary_rpc_method_handler(deny)
