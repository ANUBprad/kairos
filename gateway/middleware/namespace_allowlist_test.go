package middleware

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"Kairos/gateway/config"
	"Kairos/gateway/httpWriter"
)

func requestWithNamespace(namespace string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	return req.WithContext(
		contextWithNamespace(req.Context(), namespace),
	)
}

func TestNamespaceAllowlist(t *testing.T) {
	tests := []struct {
		name           string
		allowed        []string
		namespace      string
		expectedStatus int
	}{
		{
			name:           "empty allowlist permits any namespace",
			allowed:        nil,
			namespace:      "anynamespace",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "namespace in allowlist",
			allowed:        []string{"teama", "teamb"},
			namespace:      "teamb",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "namespace outside allowlist is refused",
			allowed:        []string{"teama"},
			namespace:      "victimtenant",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "allowlist match is exact not prefix",
			allowed:        []string{"teama"},
			namespace:      "teamalicious",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "missing namespace is refused",
			allowed:        []string{"teama"},
			namespace:      "",
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{AllowedNamespaces: tt.allowed}

			recorder := httptest.NewRecorder()
			handler := NamespaceAllowlist(cfg)(dummyHandler)
			handler.ServeHTTP(recorder, requestWithNamespace(tt.namespace))

			if recorder.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, recorder.Code)
			}
		})
	}
}

func TestNamespaceAllowlistRunsAfterAuthRejectsUnauthenticatedCallers(t *testing.T) {
	cfg := &config.Config{}
	cfg.Auth = "test-secret"
	cfg.AllowedNamespaces = []string{"teama"}

	var reachedHandler bool
	spy := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reachedHandler = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Secret", "test-secret")
	req.Header.Set("X-Namespace", "victimtenant")

	recorder := httptest.NewRecorder()
	Auth(cfg)(NamespaceAllowlist(cfg)(spy)).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403 for a namespace outside the allowlist, got %d", recorder.Code)
	}
	if reachedHandler {
		t.Error("the protected handler ran despite the namespace being refused")
	}
}

func TestLoggingDoesNotEmitCredentials(t *testing.T) {
	var logs bytes.Buffer
	original := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(original) })

	cfg := &config.Config{}
	cfg.Auth = "super-secret-credential"

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Secret", cfg.Auth)
	req.Header.Set("X-Namespace", "teama")
	req.Header.Set("Authorization", "Bearer another-secret")

	recorder := httptest.NewRecorder()
	Auth(cfg)(Namespace(NamespaceAllowlist(cfg)(Logging(dummyHandler)))).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if logs.Len() == 0 {
		t.Fatal("expected the request to be logged")
	}
	for _, credential := range []string{cfg.Auth, "another-secret", "X-Secret", "Authorization"} {
		if strings.Contains(logs.String(), credential) {
			t.Errorf("logs leaked %q: %s", credential, logs.String())
		}
	}
}

func contextWithNamespace(ctx context.Context, namespace string) context.Context {
	return context.WithValue(ctx, httpWriter.NamespaceKey{}, namespace)
}
