package queue

import (
	"Kairos/gateway/metrics"
	pb "Kairos/generated/go/proto"
	"context"
	"errors"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

type jobChannelStruct struct {
	jobId      uuid.UUID
	jobDetails *pb.IngestDocumentRequest
}

type IngestionQueue struct {
	tracker      *JobTracker
	intelClient  pb.IntelligenceServiceClient
	jobCh        chan jobChannelStruct
	workerCount  int
	wg           sync.WaitGroup
	cancel       context.CancelFunc
	shutdownOnce sync.Once
}

func NewIngestionQueue(ctx context.Context, tracker *JobTracker, client pb.IntelligenceServiceClient) *IngestionQueue {
	return NewIngestionQueueWithWorkers(ctx, tracker, client, 4)
}

func NewIngestionQueueWithWorkers(ctx context.Context, tracker *JobTracker, client pb.IntelligenceServiceClient, workers int) *IngestionQueue {
	ctx, cancel := context.WithCancel(ctx)
	jobChannel := make(chan jobChannelStruct, 254)
	q := &IngestionQueue{
		tracker:     tracker,
		intelClient: client,
		jobCh:       jobChannel,
		workerCount: workers,
		cancel:      cancel,
	}

	metrics.WorkerPoolSize.Set(float64(workers))

	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker(ctx, i)
	}

	return q
}

func (q *IngestionQueue) worker(ctx context.Context, id int) {
	defer q.wg.Done()
	slog.Info("Ingestion worker started", "worker_id", id)

	for {
		select {
		case job, ok := <-q.jobCh:
			if !ok {
				return
			}
			q.processJob(ctx, job, id)
		case <-ctx.Done():
			slog.Info("Ingestion worker shutting down", "worker_id", id)
			return
		}
	}
}

func (q *IngestionQueue) processJob(ctx context.Context, job jobChannelStruct, workerID int) {
	metrics.ActiveIngestionJobs.Inc()
	start := time.Now()

	tracker := q.tracker
	tracker.UpdateStatus(job.jobId, Processing, "")

	maxRetries := 3
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			// Add jitter to prevent thundering herd on retries
			jitter := time.Duration(rand.Int63n(int64(backoff) / 2))
			backoff = backoff + jitter

			metrics.IngestionRetries.WithLabelValues("").Inc()
			slog.Info("Retrying ingestion job",
				"job_id", job.jobId,
				"attempt", attempt,
				"backoff", backoff,
				"worker_id", workerID,
			)
			timer := time.NewTimer(backoff)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				metrics.ActiveIngestionJobs.Dec()
				tracker.UpdateStatus(job.jobId, Failed, "cancelled during retry")
				return
			}
		}

		_, err := q.intelClient.IngestDocument(ctx, job.jobDetails)
		if err == nil {
			metrics.ActiveIngestionJobs.Dec()
			duration := time.Since(start)
			metrics.IngestionJobDuration.WithLabelValues("completed").Observe(duration.Seconds())
			tracker.UpdateStatus(job.jobId, Completed, "")
			slog.Info("Ingestion job completed",
				"job_id", job.jobId,
				"duration", duration.String(),
				"worker_id", workerID,
			)
			return
		}
		lastErr = err
		slog.Warn("Ingestion job attempt failed",
			"job_id", job.jobId,
			"attempt", attempt,
			"error", err,
			"worker_id", workerID,
		)
	}

	metrics.ActiveIngestionJobs.Dec()
	duration := time.Since(start)
	metrics.IngestionJobDuration.WithLabelValues("failed").Observe(duration.Seconds())
	metrics.IngestionJobFailures.WithLabelValues("max_retries").Inc()
	tracker.UpdateStatus(job.jobId, Failed, lastErr.Error())
	slog.Error("Ingestion job failed after retries",
		"job_id", job.jobId,
		"error", lastErr,
		"worker_id", workerID,
	)
}

func (q *IngestionQueue) Enqueue(id uuid.UUID, details *pb.IngestDocumentRequest) error {
	job := jobChannelStruct{
		jobId:      id,
		jobDetails: details,
	}
	select {
	case q.jobCh <- job:
		return nil
	default:
		return errors.New("queue is full")
	}
}

func (q *IngestionQueue) Shutdown() {
	q.shutdownOnce.Do(func() {
		slog.Info("Shutting down ingestion queue", "worker_count", q.workerCount)
		close(q.jobCh)
		q.wg.Wait()
		slog.Info("Ingestion queue shut down cleanly")
	})
}
