package api

import (
	"Kairos/gateway/httpWriter"
	"net/http"
	"time"
)

type HealthStatusResponse struct {
	GatewayUp       bool   `json:"gateway_up"`
	GatewayLatency  string `json:"gateway_latency"`
	UptimeSeconds   int64  `json:"uptime_seconds"`
	CacheSize       int    `json:"cache_size"`
	CacheHitRatePCT float32 `json:"cache_hit_rate_pct"`
}

var startTime = time.Now()

func CheckHealth(w http.ResponseWriter, r *http.Request) {
	latency := time.Since(startTime)

	httpWriter.RespondWithJSON(w, 200, HealthStatusResponse{
		GatewayUp:       true,
		GatewayLatency:  latency.String(),
		UptimeSeconds:   int64(time.Since(startTime).Seconds()),
		CacheSize:       0,
		CacheHitRatePCT: 0,
	})

}
