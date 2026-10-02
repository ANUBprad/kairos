package config

import (
	"strings"
	"testing"
)

func TestLoadEnvFailsClosedInProduction(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		wantErr string
	}{
		{
			name: "production without secret",
			env: map[string]string{
				"KAIROS_ENVIRONMENT":        "production",
				"KAIROS_SECRET":             "",
				"KAIROS_ALLOWED_NAMESPACES": "team-a",
			},
			wantErr: "KAIROS_SECRET",
		},
		{
			name: "production without namespace allowlist",
			env: map[string]string{
				"KAIROS_ENVIRONMENT":        "production",
				"KAIROS_SECRET":             "prod-secret",
				"KAIROS_ALLOWED_NAMESPACES": " , ,",
			},
			wantErr: "KAIROS_ALLOWED_NAMESPACES",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("KAIROS_ENVIRONMENT", tt.env["KAIROS_ENVIRONMENT"])
			t.Setenv("KAIROS_SECRET", tt.env["KAIROS_SECRET"])
			t.Setenv("KAIROS_ALLOWED_NAMESPACES", tt.env["KAIROS_ALLOWED_NAMESPACES"])

			cfg, err := LoadEnv()
			if err == nil {
				t.Fatalf("expected startup to fail closed, got config %+v", cfg)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error to mention %q, got %v", tt.wantErr, err)
			}
			if cfg != nil {
				t.Fatalf("expected nil config alongside the error, got %+v", cfg)
			}
		})
	}
}

func TestLoadEnvAcceptsProductionWithSecretAndAllowlist(t *testing.T) {
	t.Setenv("KAIROS_ENVIRONMENT", "production")
	t.Setenv("KAIROS_SECRET", "prod-secret")
	t.Setenv("KAIROS_ALLOWED_NAMESPACES", "team-a, team-b ,")

	cfg, err := LoadEnv()
	if err != nil {
		t.Fatalf("expected a valid production config, got %v", err)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected environment production, got %q", cfg.Environment)
	}
	want := []string{"team-a", "team-b"}
	if len(cfg.AllowedNamespaces) != len(want) {
		t.Fatalf("expected allowlist %v, got %v", want, cfg.AllowedNamespaces)
	}
	for i, namespace := range want {
		if cfg.AllowedNamespaces[i] != namespace {
			t.Errorf("expected allowlist[%d] %q, got %q", i, namespace, cfg.AllowedNamespaces[i])
		}
	}
}

func TestLoadEnvDevelopmentAllowsEmptySecretAndAllowlist(t *testing.T) {
	t.Setenv("KAIROS_ENVIRONMENT", "")
	t.Setenv("KAIROS_SECRET", "")
	t.Setenv("KAIROS_ALLOWED_NAMESPACES", "")

	cfg, err := LoadEnv()
	if err != nil {
		t.Fatalf("expected development config to load, got %v", err)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected environment to default to development, got %q", cfg.Environment)
	}
	if len(cfg.AllowedNamespaces) != 0 {
		t.Errorf("expected an empty allowlist, got %v", cfg.AllowedNamespaces)
	}
}

func TestLoadEnvReadsIntelligenceTLS(t *testing.T) {
	t.Setenv("KAIROS_GRPC_TLS_CA", "/run/secrets/ca.crt")
	t.Setenv("KAIROS_GRPC_TLS_SERVER_NAME", "intelligence")

	cfg, err := LoadEnv()
	if err != nil {
		t.Fatalf("LoadEnv: %v", err)
	}
	if cfg.Intelligence.TLSCA != "/run/secrets/ca.crt" {
		t.Errorf("expected TLS CA to be read, got %q", cfg.Intelligence.TLSCA)
	}
	if cfg.Intelligence.TLSServerName != "intelligence" {
		t.Errorf("expected TLS server name to be read, got %q", cfg.Intelligence.TLSServerName)
	}
}
