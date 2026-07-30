package main

import (
	"Kairos/gateway/api"
	config "Kairos/gateway/config"
	"Kairos/gateway/intelligence"
	"Kairos/gateway/queue"
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {

	envVar, loadErr := config.LoadEnv()

	if loadErr != nil {
		slog.Error("Unable to load env",
			"ERROR", loadErr)
		os.Exit(1)
	} else {
		slog.Info("Loaded Env")
	}
	pythonClient, conn, intelServerErr := intelligence.ConnectToPython(envVar)

	if intelServerErr != nil {
		slog.Error("Unable to connect with the intelligence client",
			"ERROR", intelServerErr)
		os.Exit(1)
	} else {
		slog.Info("Connected with the Intelligence layer")
	}

	tracker := queue.NewJobTracker()
	inQueue := queue.NewIngestionQueue(context.Background(), tracker, pythonClient)
	mainRouter, routingErr := api.NewRouter(envVar, pythonClient, inQueue, tracker)

	if routingErr != nil {
		slog.Error("Unable to get router.",
			"ERROR", routingErr)
		os.Exit(1)
	} else {
		slog.Info("Router Initialized Successfully.....")
	}

	// Start job tracker eviction (every 5 minutes, expire jobs older than 1 hour)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	tracker.StartEviction(ctx, 1*time.Hour, 5*time.Minute)

	port := envVar.Gateway.Port
	host := envVar.Gateway.Host
	address := host + ":" + port
	slog.Info("Starting server", "address", address)

	server := &http.Server{
		Handler:      mainRouter,
		Addr:         address,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server error", "ERROR", err)
		}
	}()

	slog.Info("Server started", "PORT", server.Addr)

	<-quit // Blocks until signal received

	slog.Info("Shutting Down server......")

	// Correct shutdown ordering:
	// 1. Stop accepting new HTTP requests, drain in-flight
	// 2. Shut down ingestion queue (drain workers)
	// 3. Close gRPC connection
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Forced HTTP Shutdown", "ERROR", err)
	}

	inQueue.Shutdown()

	err := conn.Close()
	if err != nil {
		slog.Error("Couldn't close intelligence client server", "ERROR", err)
	}

	// Cancel the eviction context
	cancel()

	slog.Info("Server stopped")
}
