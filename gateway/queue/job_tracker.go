package queue

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Status int

const (
	Pending = iota
	Processing
	Completed
	Failed
)

type jobEntry struct {
	jobStatus Status
	jobError  string
	createdAt time.Time
}

type JobTracker struct {
	jobsMap map[uuid.UUID]*jobEntry
	mutex   *sync.RWMutex
}

func NewJobTracker() *JobTracker {
	jobMap := make(map[uuid.UUID]*jobEntry)
	mutex := sync.RWMutex{}
	return &JobTracker{jobsMap: jobMap, mutex: &mutex}
}

func (tracker *JobTracker) CreateJob() (uuid.UUID, error) {
	tracker.mutex.Lock()
	defer tracker.mutex.Unlock()
	id, err := uuid.NewUUID()
	if err != nil {
		return uuid.Nil, err
	}
	tracker.jobsMap[id] = &jobEntry{
		jobError:  "",
		jobStatus: Pending,
		createdAt: time.Now(),
	}
	return id, nil
}

func (tracker *JobTracker) UpdateStatus(id uuid.UUID, stat Status, errMsg string) {
	tracker.mutex.Lock()
	defer tracker.mutex.Unlock()
	job := tracker.jobsMap[id]
	if job == nil {
		return
	}
	job.jobStatus = stat
	job.jobError = errMsg
}

func (tracker *JobTracker) GetJob(id uuid.UUID) (*jobEntry, error) {
	tracker.mutex.RLock()
	defer tracker.mutex.RUnlock()
	job := tracker.jobsMap[id]
	if job == nil {
		return nil, errors.New("job not found")
	}
	return job, nil
}

func (tracker *JobTracker) EvictExpired(ttl time.Duration) int {
	tracker.mutex.Lock()
	defer tracker.mutex.Unlock()

	cutoff := time.Now().Add(-ttl)
	evicted := 0

	for id, job := range tracker.jobsMap {
		if job.jobStatus == Completed || job.jobStatus == Failed {
			if job.createdAt.Before(cutoff) {
				delete(tracker.jobsMap, id)
				evicted++
			}
		}
	}

	return evicted
}

func (tracker *JobTracker) ActiveCount() int {
	tracker.mutex.RLock()
	defer tracker.mutex.RUnlock()

	count := 0
	for _, job := range tracker.jobsMap {
		if job.jobStatus == Pending || job.jobStatus == Processing {
			count++
		}
	}
	return count
}

func (job *jobEntry) GetStatus() Status {
	return job.jobStatus
}

func (job *jobEntry) GetJobError() string {
	return job.jobError
}
