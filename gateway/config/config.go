package config

import (
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
	}

	Chroma struct {
		Host string
		Port string
	}

	Auth string
	APIs struct {
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

	config.Chroma.Host = os.Getenv("CHROMA_STORE_HOST")
	config.Chroma.Port = os.Getenv("CHROMA_STORE_PORT")

	config.Auth = os.Getenv("KAIROS_SECRET")
	config.APIs.GEMINI = os.Getenv("GEMINI_API_KEY")
	config.APIs.OPENAI = os.Getenv("OPENAI_API_KEY")

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

	// Validate required configuration
	if config.Auth == "" {
		slog.Warn("KAIROS_SECRET is not set — all API requests will be rejected in production")
	}

	return &config, nil
}
