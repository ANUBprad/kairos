import { randomUUID } from "node:crypto";
import type { Job, JobType, JobHandler, JobQueue } from "./types";

class InMemoryJobQueue implements JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private processing = false;

  register(type: JobType, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  enqueue(documentId: string, type: JobType): Job {
    const job: Job = {
      id: randomUUID(),
      type,
      documentId,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };
    this.jobs.set(job.id, job);
    this.processNext().catch(() => {});
    return job;
  }

  async processNext() {
    if (this.processing) return;
    this.processing = true;

    try {
      const pending = Array.from(this.jobs.values())
        .filter((j) => j.status === "pending")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      for (const job of pending) {
        await this.runJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: Job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job type: ${job.type}`;
      return;
    }

    job.status = "running";
    job.startedAt = new Date();

    try {
      await handler(job);
      job.status = "completed";
      job.completedAt = new Date();
    } catch (err) {
      job.retryCount++;
      if (job.retryCount >= job.maxRetries) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
      } else {
        job.status = "pending";
      }
    }
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getJobsForDocument(documentId: string): Job[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.documentId === documentId,
    );
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (job && (job.status === "pending" || job.status === "running")) {
      job.status = "cancelled";
    }
  }

  getPendingCount(): number {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === "pending" || j.status === "running",
    ).length;
  }
}

export const jobQueue: JobQueue = new InMemoryJobQueue();
export type { JobQueue } from "./types";
