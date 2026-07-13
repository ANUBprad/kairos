package api

import (
	"Kairos/gateway/config"
	"Kairos/gateway/middleware"
	"Kairos/gateway/queue"
	pb "Kairos/generated/go/proto"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func NewRouter(envVar *config.Config, intelClient pb.IntelligenceServiceClient, inQueue *queue.IngestionQueue, tracker *queue.JobTracker) (*chi.Mux, error) {
	mainRouter := chi.NewRouter()

	ingestHandler := NewIngestHandler(int32(envVar.MaxFileSize), inQueue, tracker)

	jobHandler := NewJobHandler(tracker)

	corsOrigins := envVar.CORSOrigins
	if len(corsOrigins) == 0 {
		corsOrigins = []string{"*"}
	}

	mainRouter.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedHeaders:   []string{"Content-Type", "X-Secret", "X-Namespace", "X-Trace-ID"},
		AllowCredentials: false,
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		MaxAge:           500,
	}))

	queryHandler := NewQueryHandler(intelClient, envVar.Cache.TTL, envVar.Cache.MaxSize, float32(envVar.Cache.SimilarityThreshold))

	mainRouter.Use(middleware.Tracing)
	mainRouter.Use(middleware.Logging)

	v1Router := chi.NewRouter()

	v1Router.Use(middleware.Auth(envVar))
	v1Router.Use(middleware.Namespace)
	v1Router.Use(middleware.RateLimit(envVar))

	mainRouter.Get("/health", CheckHealth)
	v1Router.Post("/query", queryHandler.HandleUserQuery)
	v1Router.Post("/ingest", ingestHandler.IngestUserDoc)
	v1Router.Get("/jobs/{job_id}", jobHandler.UserJobHandler)

	mainRouter.Handle("/static/*", http.StripPrefix("/static", StaticFileHandler()))

	mainRouter.Get("/", ServeUIPage("index.html"))
	mainRouter.Get("/query", ServeUIPage("query.html"))

	mainRouter.Handle("/metrics", promhttp.Handler())
	mainRouter.Mount("/v1", v1Router)

	return mainRouter, nil
}
