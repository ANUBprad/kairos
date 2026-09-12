"""Regression guard for the generated protobuf package name.

The Python stubs are regenerated from proto/rag.proto by scripts/gen_proto.py.
If that file drifts to a package other than kairos.v1, gRPC method paths
mismatch between the Go gateway and the Python server at runtime, so the
package name is pinned here.
"""

from generated.python import rag_pb2

EXPECTED_SERVICE = "kairos.v1.IntelligenceService"


def test_intelligence_service_full_name() -> None:
    service = rag_pb2.DESCRIPTOR.services_by_name["IntelligenceService"]
    assert service.full_name == EXPECTED_SERVICE
