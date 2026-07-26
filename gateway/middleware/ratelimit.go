package middleware

import (
	"Kairos/gateway/config"
	"Kairos/gateway/httpWriter"
	"net/http"
	"strconv"
	"sync"

	"golang.org/x/time/rate"
)

func RateLimit(envVar *config.Config) func(http.Handler) http.Handler {
	clients := sync.Map{}
	rateLimitVal := envVar.RateLimit
	burstVal := envVar.BurstLimit
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			namespace, ok := ctx.Value(httpWriter.NamespaceKey{}).(string)
			if !ok || namespace == "" {
				httpWriter.RespondWithError(w, 400, "Missing namespace")
				return
			}

			val, _ := clients.LoadOrStore(namespace, rate.NewLimiter(rate.Limit(rateLimitVal), burstVal))

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
