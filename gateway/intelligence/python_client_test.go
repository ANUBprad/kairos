package intelligence

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"Kairos/gateway/config"
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

func TestTransportCredentialsEmptyCAStaysPlaintext(t *testing.T) {
	cfg := &config.Config{}
	if _, err := transportCredentials(cfg); err != nil {
		t.Fatalf("expected an unset CA to select the plaintext transport, got %v", err)
	}
}

func TestTransportCredentialsRejectsUnreadableCA(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "absent-ca.pem")
	cfg := &config.Config{}
	cfg.Intelligence.TLSCA = missing

	if _, err := transportCredentials(cfg); err == nil {
		t.Fatal("expected an unreadable CA bundle to fail instead of downgrading to plaintext")
	}
}

func TestTransportCredentialsAcceptsValidCA(t *testing.T) {
	cfg := &config.Config{}
	cfg.Intelligence.TLSCA = writeTestCA(t)
	cfg.Intelligence.TLSServerName = "intelligence"

	if _, err := transportCredentials(cfg); err != nil {
		t.Fatalf("expected a valid CA to select the TLS transport, got %v", err)
	}
}

// writeTestCA generates a self-signed CA bundle on disk so transport selection
// is exercised against a real certificate rather than a fixture.
func writeTestCA(t *testing.T) string {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	template := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "kairos-test-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	path := filepath.Join(t.TempDir(), "ca.pem")
	encoded := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatalf("write CA: %v", err)
	}
	return path
}
