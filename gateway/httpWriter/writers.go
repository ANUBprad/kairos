package httpWriter

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
)

type NamespaceKey struct{}

func RespondWithJSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	data, err := json.Marshal(payload)

	if err != nil {
		slog.Error(
			"Unable to marshal JSON",
			"Payload", payload,
			"ERROR", err,
		)
		w.WriteHeader(500)
		return
	}

	w.Header().Add("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_, writeErr := w.Write(data)

	if writeErr != nil {
		slog.Error(
			"Unable to write data",
			"ERROR", writeErr,
		)
		return
	}

}

func RespondWithError(w http.ResponseWriter, statusCode int, msg string) {
	RespondWithErrorID(w, statusCode, msg, "")
}

// RespondWithErrorID returns a standardized error response with an errorId for correlation.
// The errorId is generated if not provided, allowing clients to reference specific errors.
func RespondWithErrorID(w http.ResponseWriter, statusCode int, msg string, errorId string) {
	if statusCode > 499 {
		slog.Error(
			"Server Side Error",
			"status", statusCode,
			"error", msg,
			"errorId", errorId,
		)
	}

	if errorId == "" {
		errorId = uuid.New().String()[:8]
	}

	type errResponse struct {
		Error   string `json:"error"`
		ErrorID string `json:"errorId"`
	}

	RespondWithJSON(w, statusCode, errResponse{
		Error:   msg,
		ErrorID: errorId,
	})
}
