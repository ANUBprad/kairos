package intelligence

import (
	"context"
	"net"
	"strings"
	"sync"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
)

type metadataCapture struct {
	mu    sync.Mutex
	calls [][]string
}

func (c *metadataCapture) captureUnary(
	ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler,
) (any, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	c.mu.Lock()
	var flat []string
	for k, vs := range md {
		for _, v := range vs {
			flat = append(flat, k+"="+v)
		}
	}
	c.calls = append(c.calls, flat)
	c.mu.Unlock()
	return handler(ctx, req)
}

func (c *metadataCapture) has(key, value string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, pairs := range c.calls {
		for _, p := range pairs {
			if p == key+"="+value {
				return true
			}
		}
	}
	return false
}

func (c *metadataCapture) hasAnyWithPrefix(prefix string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, pairs := range c.calls {
		for _, p := range pairs {
			if strings.HasPrefix(p, prefix) {
				return true
			}
		}
	}
	return false
}

func startAuthServer(t *testing.T) (string, *metadataCapture) {
	t.Helper()
	capture := &metadataCapture{}
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	srv := grpc.NewServer(grpc.UnaryInterceptor(capture.captureUnary))
	healthSrv := health.NewServer()
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(srv, healthSrv)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String(), capture
}

func dialWithAuth(t *testing.T, addr, secret string) *grpc.ClientConn {
	t.Helper()
	conn, err := grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		serviceAuth(secret),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func TestServiceAuthAttachesServiceCredential(t *testing.T) {
	addr, capture := startAuthServer(t)
	conn := dialWithAuth(t, addr, "test-service-secret")
	client := grpc_health_v1.NewHealthClient(conn)

	if _, err := client.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("health check: %v", err)
	}

	if !capture.has("x-api-key", "test-service-secret") {
		t.Fatalf("expected x-api-key=test-service-secret on outbound metadata, captured: %v", capture.calls)
	}
}

func TestServiceAuthEmptySecretSendsNoCredential(t *testing.T) {
	addr, capture := startAuthServer(t)
	conn := dialWithAuth(t, addr, "")
	client := grpc_health_v1.NewHealthClient(conn)

	if _, err := client.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("health check: %v", err)
	}

	if capture.hasAnyWithPrefix("x-api-key=") {
		t.Fatalf("expected no x-api-key metadata when secret is empty, captured: %v", capture.calls)
	}
}