package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type traceIDKey struct{}

// W3C TraceContext header names for distributed tracing
const (
	HeaderTraceParent = "Traceparent"
	HeaderTraceState  = "Tracestate"
)

// TraceState holds W3C TraceContext values for propagation
type TraceState struct {
	TraceParent string
	Tracestate  string
}

func Tracing(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		// Extract or generate W3C TraceContext
		traceParent := r.Header.Get(HeaderTraceParent)
		traceState := r.Header.Get(HeaderTraceState)

		if traceParent == "" {
			// Generate a new W3C TraceContext: version-trace_id-parent_id-trace_flags
			// trace_id is 32 hex chars (16 bytes), parent_id is 16 hex chars (8 bytes)
			traceIDHex := strings.ReplaceAll(traceID, "-", "")
			traceParent = "00-" + traceIDHex + "-" + strings.Repeat("0", 16) + "-01"
		}

		ctx := context.WithValue(r.Context(), traceIDKey{}, traceID)

		w.Header().Set("X-Trace-ID", traceID)
		w.Header().Set(HeaderTraceParent, traceParent)
		if traceState != "" {
			w.Header().Set(HeaderTraceState, traceState)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetTraceID(ctx context.Context) string {
	if id, ok := ctx.Value(traceIDKey{}).(string); ok {
		return id
	}
	return ""
}


