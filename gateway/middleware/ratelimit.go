package middleware

import (
	"Kairos/gateway/config"
	"Kairos/gateway/httpWriter"
	"Kairos/gateway/metrics"
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
			namespace := ctx.Value(httpWriter.NamespaceKey{}).(string)

			val, _ := clients.LoadOrStore(namespace, rate.NewLimiter(rate.Limit(rateLimitVal), burstVal))

			clientLimiter := val.(*rate.Limiter)
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
