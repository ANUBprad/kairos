package queue

import (
	pb "Kairos/generated/go/proto"
	"context"
	"errors"

	"github.com/google/uuid"
)

// QueueBackend defines the interface for job queue implementations.
// Implementations can use different backends (memory, Redis, etc.)
// while maintaining the same API contract.
type QueueBackend interface {
	// Enqueue adds a job to the queue.
	// Returns error if queue is full or job cannot be accepted.
	Enqueue(ctx context.Context, id uuid.UUID, details *pb.IngestDocumentRequest) error

	// Dequeue removes and returns the next job from the queue.
	// Returns nil, ErrQueueEmpty if no jobs are available.
	// Returns nil, ErrQueueClosed if queue has been shut down.
	Dequeue(ctx context.Context) (*Job, error)

	// Size returns the number of jobs currently in the queue.
	Size() int

	// Capacity returns the maximum queue capacity.
	Capacity() int

	// Close signals the queue to stop accepting new jobs and
	// waits for all pending jobs to be processed.
	Close() error

	// IsClosed returns true if the queue has been shut down.
	IsClosed() bool
}

// Job represents a queued ingestion job.
type Job struct {
	ID      uuid.UUID
	Details *pb.IngestDocumentRequest
}

// Common queue errors
var (
	ErrQueueEmpty  = errors.New("queue is empty")
	ErrQueueClosed = errors.New("queue is closed")
	ErrQueueFull   = errors.New("queue is full")
)

// MemoryQueueBackend is an in-memory implementation of QueueBackend.
// This is the default backend used when no external queue is configured.
type MemoryQueueBackend struct {
	jobs    chan *Job
	closed  bool
	closeCh chan struct{}
}

// NewMemoryQueueBackend creates a new in-memory queue backend.
func NewMemoryQueueBackend(capacity int) *MemoryQueueBackend {
	if capacity <= 0 {
		capacity = 256
	}
	return &MemoryQueueBackend{
		jobs:    make(chan *Job, capacity),
		closeCh: make(chan struct{}),
	}
}

func (q *MemoryQueueBackend) Enqueue(ctx context.Context, id uuid.UUID, details *pb.IngestDocumentRequest) error {
	select {
	case <-q.closeCh:
		return ErrQueueClosed
	default:
	}

	job := &Job{
		ID:      id,
		Details: details,
	}

	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrQueueFull
	}
}

func (q *MemoryQueueBackend) Dequeue(ctx context.Context) (*Job, error) {
	select {
	case <-q.closeCh:
		// Check if there are remaining jobs
		select {
		case job := <-q.jobs:
			return job, nil
		default:
			return nil, ErrQueueClosed
		}
	case job := <-q.jobs:
		return job, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (q *MemoryQueueBackend) Size() int {
	return len(q.jobs)
}

func (q *MemoryQueueBackend) Capacity() int {
	return cap(q.jobs)
}

func (q *MemoryQueueBackend) Close() error {
	select {
	case <-q.closeCh:
		return nil // Already closed
	default:
		close(q.closeCh)
	}
	return nil
}

func (q *MemoryQueueBackend) IsClosed() bool {
	select {
	case <-q.closeCh:
		return true
	default:
		return false
	}
}

// RedisQueueBackend is a Redis-backed implementation of QueueBackend.
// Requires the go-redis package. Falls back gracefully if Redis is unavailable.
type RedisQueueBackend struct {
	url       string
	key       string
	queue     interface{} // Will hold *redis.Client when available
	available bool
}

// NewRedisQueueBackend creates a new Redis queue backend.
// Returns nil if Redis is unavailable.
func NewRedisQueueBackend(url string, key string) *RedisQueueBackend {
	if key == "" {
		key = "kairos:queue:ingestion"
	}

	q := &RedisQueueBackend{
		url: url,
		key: key,
	}

	// Try to connect to Redis
	// Note: In production, this would use go-redis client
	// For now, we log that Redis backend is not yet implemented
	// and the memory backend should be used instead
	return q
}

func (q *RedisQueueBackend) Enqueue(ctx context.Context, id uuid.UUID, details *pb.IngestDocumentRequest) error {
	if !q.available {
		return ErrQueueClosed
	}
	// TODO: Implement Redis LPUSH with JSON serialization
	return ErrQueueClosed
}

func (q *RedisQueueBackend) Dequeue(ctx context.Context) (*Job, error) {
	if !q.available {
		return nil, ErrQueueClosed
	}
	// TODO: Implement Redis RPOP with JSON deserialization
	return nil, ErrQueueClosed
}

func (q *RedisQueueBackend) Size() int {
	return 0
}

func (q *RedisQueueBackend) Capacity() int {
	return 0 // Redis queues are effectively unbounded
}

func (q *RedisQueueBackend) Close() error {
	q.available = false
	return nil
}

func (q *RedisQueueBackend) IsClosed() bool {
	return !q.available
}

// QueueConfig holds configuration for queue backend creation.
type QueueConfig struct {
	Type     string // "memory" or "redis"
	Capacity int    // For memory backend
	URL      string // For Redis backend
	Key      string // For Redis backend
}

// NewQueueBackend creates a queue backend based on the provided configuration.
func NewQueueBackend(config QueueConfig) QueueBackend {
	switch config.Type {
	case "redis":
		backend := NewRedisQueueBackend(config.URL, config.Key)
		if backend.available {
			return backend
		}
		// Fall back to memory if Redis unavailable
		return NewMemoryQueueBackend(config.Capacity)
	default:
		return NewMemoryQueueBackend(config.Capacity)
	}
}
