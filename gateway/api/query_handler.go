package api

import (
	"Kairos/gateway/httpWriter"
	"Kairos/gateway/intelligence"
	"Kairos/gateway/metrics"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const maxQueryBodySize = 1 << 20 // 1 MB

func (qHandler *QueryHandler) HandleUserQuery(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx := r.Context()
	namespace, ok := ctx.Value(httpWriter.NamespaceKey{}).(string)
	if !ok {
		httpWriter.RespondWithError(w, 400, "Missing namespace")
		return
	}

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, maxQueryBodySize)

	var queryReq struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&queryReq); err != nil {
		if err == io.EOF {
			httpWriter.RespondWithError(w, 400, "Empty request body")
		} else {
			httpWriter.RespondWithError(w, 400, "Invalid request body")
		}
		return
	}

	query := strings.TrimSpace(queryReq.Query)
	if query == "" {
		httpWriter.RespondWithError(w, 400, "Query is required")
		return
	}
	if len(query) > 10000 {
		httpWriter.RespondWithError(w, 400, "Query exceeds maximum length")
		return
	}

	queryEmbed, err := intelligence.ComputeEmbeddings(qHandler.intelClient, query)

	if err != nil {
		httpWriter.RespondWithError(w, 502, "Unable to compute embeddings")
		slog.Error("Unable to calc embeddings", "ERROR", err)
		return
	}

	response, ok := qHandler.semCache.Get(namespace, queryEmbed)
	if !ok { // cache miss
		metrics.CacheMisses.WithLabelValues(namespace).Inc()
		queryDetails, err := intelligence.ClassifyQuery(qHandler.intelClient, query, namespace)
		if err != nil {
			httpWriter.RespondWithError(w, 502, "Unable to classify query")
			slog.Error("Unable to reach ClassifyQuery", "ERROR", err)
			return
		}
		queryConfig := queryDetails.Config

		retrieval, err := intelligence.ExecuteRetrieval(qHandler.intelClient, query, queryConfig, namespace)
		if err != nil {
			httpWriter.RespondWithError(w, 502, "Unable to retrieve data")
			slog.Error("Unable to reach Retrieve data", "ERROR", err)
			return
		}

		if !retrieval.RetrievalStatus {
			slog.Info(
				"No retrieval took place",
				"Retrieval Status", retrieval.RetrievalStatus)
		}
		retrievedChunks := retrieval.RetrievedChunk

		finalResponse, err := intelligence.GenerateResponse(qHandler.intelClient, namespace, query, retrievedChunks)

		if err != nil {
			httpWriter.RespondWithError(w, 502, "Unable to generate response")
			slog.Error("Unable to fetch Response", "ERROR", err)
			return
		}

		metrics.TokenUsage.WithLabelValues(namespace, finalResponse.Model).Add(float64(finalResponse.PromptTokens + finalResponse.CompletionTokens))

		qHandler.semCache.Set(namespace, query, queryEmbed, finalResponse.Response)

		tier := strings.ToLower(queryDetails.Config.RetrievalType.String())
		metrics.QueryLatency.WithLabelValues(tier).Observe(time.Since(startTime).Seconds())
		httpWriter.RespondWithJSON(w, 200, queryResponseStruct{
			Response:         finalResponse.Response,
			PromptTokens:     finalResponse.PromptTokens,
			CompletionToken:  finalResponse.CompletionTokens,
			ResponseModel:    finalResponse.Model,
			CacheHit:         false,
			RetrievalDetails: queryConfig,
		})

		return
	}

	metrics.CacheHits.WithLabelValues(namespace).Inc()

	httpWriter.RespondWithJSON(w, 200, queryResponseStruct{
		Response:         response,
		PromptTokens:     0,
		CompletionToken:  0,
		ResponseModel:    "",
		CacheHit:         true,
		RetrievalDetails: nil,
	})
}
