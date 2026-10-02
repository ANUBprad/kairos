package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Gateway struct {
		Host string
		Port string
	}

	Intelligence struct {
		Host string
		Port string
		// TLSCA is the PEM bundle used to verify the Intelligence server
		// certificate. Empty means plaintext, which the transport policy only
		// permits on loopback or outside production.
		TLSCA         string
		TLSServerName string
	}

	Chroma struct {
		Host string
		Port string
	}

	Auth string
	// Environment selects the fail-closed posture: "production" refuses to
	// start on an empty secret or an empty namespace allowlist.
	Environment string
	// AllowedNamespaces bounds which client-asserted namespaces the shared
	// service credential may select. Empty means unrestricted, which only the
	// non-production environments accept.
	AllowedNamespaces []string
	APIs              struct {
		OPENAI string
		GEMINI string
	}

	Cache struct {
		TTL                 int
		MaxSize             int
		SimilarityThreshold float64
	}

	RateLimit   int
	BurstLimit  int
	MaxFileSize int
	CORSOrigins []string
}

func LoadEnv() (*Config, error) {
	err := godotenv.Load()

	if err != nil {
		slog.Info("Couldn't initialize godotenv, skipping loading", "error", err)
	}

	var config Config

	config.Gateway.Host = os.Getenv("GATEWAY_HOST")
	config.Gateway.Port = os.Getenv("GATEWAY_PORT")

	config.Intelligence.Host = os.Getenv("INTELLIGENCE_HOST")
	config.Intelligence.Port = os.Getenv("INTELLIGENCE_PORT")
	config.Intelligence.TLSCA = os.Getenv("KAIROS_GRPC_TLS_CA")
	config.Intelligence.TLSServerName = os.Getenv("KAIROS_GRPC_TLS_SERVER_NAME")

	config.Chroma.Host = os.Getenv("CHROMA_STORE_HOST")
	config.Chroma.Port = os.Getenv("CHROMA_STORE_PORT")

	config.Auth = os.Getenv("KAIROS_SECRET")
	config.Environment = strings.ToLower(strings.TrimSpace(os.Getenv("KAIROS_ENVIRONMENT")))
	if config.Environment == "" {
		config.Environment = "development"
	}
	config.APIs.GEMINI = os.Getenv("GEMINI_API_KEY")
	config.APIs.OPENAI = os.Getenv("OPENAI_API_KEY")

	if allowed := os.Getenv("KAIROS_ALLOWED_NAMESPACES"); allowed != "" {
		for _, namespace := range strings.Split(allowed, ",") {
			if trimmed := strings.TrimSpace(namespace); trimmed != "" {
				config.AllowedNamespaces = append(config.AllowedNamespaces, trimmed)
			}
		}
	}

	// Parse integers with error logging and sensible defaults
	var parseErr error
	if v := os.Getenv("KAIROS_CACHE_MAX_SIZE"); v != "" {
		config.Cache.MaxSize, parseErr = strconv.Atoi(v)
		if parseErr != nil {
			slog.Warn("Invalid KAIROS_CACHE_MAX_SIZE, using default 1000", "value", v, "error", parseErr)
			config.Cache.MaxSize = 1000
		}
	} else {
		config.Cache.MaxSize = 1000
	}

	if v := os.Getenv("KAIROS_CACHE_TTL"); v != "" {
		config.Cache.TTL, parseErr = strconv.Atoi(v)
		if parseErr != nil {
			slog.Warn("Invalid KAIROS_CACHE_TTL, using default 300", "value", v, "error", parseErr)
			config.Cache.TTL = 300
		}
	} else {
		config.Cache.TTL = 300
	}

	if v := os.Getenv("KAIROS_CACHE_SIMILARITY_THRESHOLD"); v != "" {
		var threshold float64
		threshold, parseErr = strconv.ParseFloat(v, 32)
		if parseErr != nil {
			slog.Warn("Invalid KAIROS_CACHE_SIMILARITY_THRESHOLD, using default 0.85", "value", v, "error", parseErr)
			config.Cache.SimilarityThreshold = 0.85
		} else {
			config.Cache.SimilarityThreshold = threshold
		}
	} else {
		config.Cache.SimilarityThreshold = 0.85
	}

	if v := os.Getenv("KAIROS_RATE_LIMIT"); v != "" {
		config.RateLimit, parseErr = strconv.Atoi(v)
		if parseErr != nil {
			slog.Warn("Invalid KAIROS_RATE_LIMIT, using default 30", "value", v, "error", parseErr)
			config.RateLimit = 30
		}
	} else {
		config.RateLimit = 30
	}

	if v := os.Getenv("KAIROS_BURST_LIMIT"); v != "" {
		config.BurstLimit, parseErr = strconv.Atoi(v)
		if parseErr != nil {
			slog.Warn("Invalid KAIROS_BURST_LIMIT, using default 50", "value", v, "error", parseErr)
			config.BurstLimit = 50
		}
	} else {
		config.BurstLimit = 50
	}

	if v := os.Getenv("MAX_FILE_SIZE"); v != "" {
		config.MaxFileSize, parseErr = strconv.Atoi(v)
		if parseErr != nil {
			slog.Warn("Invalid MAX_FILE_SIZE, using default 10", "value", v, "error", parseErr)
			config.MaxFileSize = 10
		}
	} else {
		config.MaxFileSize = 10
	}

	if corsOrigins := os.Getenv("KAIROS_CORS_ORIGINS"); corsOrigins != "" {
		config.CORSOrigins = strings.Split(corsOrigins, ",")
	}

	// Fail closed in production: an empty shared secret would leave the HTTP
	// edge accepting an empty credential, and an empty allowlist would leave
	// the shared credential able to select any namespace.
	if config.Auth == "" {
		if config.Environment == "production" {
			return nil, fmt.Errorf(
				"KAIROS_SECRET must be set when KAIROS_ENVIRONMENT=production",
			)
		}
		slog.Warn("KAIROS_SECRET is not set — all authenticated API requests will be rejected")
	}

	if config.Environment == "production" && len(config.AllowedNamespaces) == 0 {
		return nil, fmt.Errorf(
			"KAIROS_ALLOWED_NAMESPACES must list at least one namespace when KAIROS_ENVIRONMENT=production",
		)
	}

	return &config, nil
}
