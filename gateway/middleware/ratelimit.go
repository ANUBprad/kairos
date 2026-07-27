package middleware

import (
	"Kairos/gateway/config"
	"Kairos/gateway/httpWriter"
	"Kairos/gateway/metrics"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const maxTrackedNamespaces = 10000

func RateLimit(envVar *config.Config) func(http.Handler) http.Handler {
	clients := sync.Map{}
	lastSeen := sync.Map{}
	rateLimitVal := envVar.RateLimit
	burstVal := envVar.BurstLimit

	// Background cleanup of stale rate limiter entries
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			staleThreshold := time.Now().Add(-10 * time.Minute)
			clients.Range(func(key, value interface{}) bool {
				if last, ok := lastSeen.Load(key); ok {
					if lastTime, ok := last.(time.Time); ok && lastTime.Before(staleThreshold) {
						clients.Delete(key)
						lastSeen.Delete(key)
					}
				}
				return true
			})
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			namespace, ok := ctx.Value(httpWriter.NamespaceKey{}).(string)
			if !ok || namespace == "" {
				httpWriter.RespondWithError(w, 400, "Missing namespace")
				return
			}

			// Check if we're tracking too many namespaces (DDoS protection)
			count := 0
			clients.Range(func(_, _ interface{}) bool {
				count++
				return count < maxTrackedNamespaces
			})
			if count >= maxTrackedNamespaces {
				// If namespace is new and we're at capacity, reject
				if _, loaded := clients.Load(namespace); !loaded {
					httpWriter.RespondWithError(w, 503, "Rate limiter at capacity")
					return
				}
			}

			val, _ := clients.LoadOrStore(namespace, rate.NewLimiter(rate.Limit(rateLimitVal), burstVal))
			lastSeen.Store(namespace, time.Now())

			clientLimiter, ok := val.(*rate.Limiter)
			if !ok {
				httpWriter.RespondWithError(w, 500, "Internal rate limiter error")
				return
			}

			reservation := clientLimiter.Reserve()
			if reservation.Delay() > 0 {
				reservation.Cancel()
				delay := int(reservation.Delay().Seconds())
				w.Header().Add(
					"Retry-After",
					strconv.Itoa(delay))

				metrics.RateLimitRejections.WithLabelValues(namespace).Inc()
				httpWriter.RespondWithError(w, 429, "Rate Limit Exceeded")
				return
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
