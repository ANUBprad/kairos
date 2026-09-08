package api

import (
	"Kairos/gateway/httpWriter"
	"context"
	"net/http"
	"time"

	"google.golang.org/grpc/health/grpc_health_v1"
)

type HealthStatusResponse struct {
	GatewayUp       bool    `json:"gateway_up"`
	GatewayLatency  string  `json:"gateway_latency"`
	UptimeSeconds   int64   `json:"uptime_seconds"`
	CacheSize       int     `json:"cache_size"`
	CacheHitRatePCT float32 `json:"cache_hit_rate_pct"`
	IntelligenceUp  bool    `json:"intelligence_up"`
	FullStackUp     bool    `json:"full_stack_up"`
}

var startTime = time.Now()

func (qHandler *QueryHandler) CheckHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	intelligenceUp := false
	if qHandler.conn != nil {
		healthClient := grpc_health_v1.NewHealthClient(qHandler.conn)
		resp, err := healthClient.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
		if err == nil && resp.GetStatus() == grpc_health_v1.HealthCheckResponse_SERVING {
			intelligenceUp = true
		}
	}

	httpWriter.RespondWithJSON(w, 200, HealthStatusResponse{
		GatewayUp:       true,
		GatewayLatency:  time.Since(startTime).String(),
		UptimeSeconds:   int64(time.Since(startTime).Seconds()),
		CacheSize:       qHandler.semCache.Size(),
		CacheHitRatePCT: float32(qHandler.semCache.HitRate()) * 100,
		IntelligenceUp:  intelligenceUp,
		FullStackUp:     intelligenceUp,
	})
}
