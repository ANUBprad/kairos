export type JobType = "extract" | "chunk" | "embed";
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Job {
  id: string;
  type: JobType;
  documentId: string;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobHandler {
  (job: Job): Promise<void>;
}

/** Interface for the job queue so it can be swapped with BullMQ or Inngest later. */
export interface JobQueue {
  register(type: JobType, handler: JobHandler): void;
  enqueue(documentId: string, type: JobType): Job;
  getJob(id: string): Job | undefined;
  getJobsForDocument(documentId: string): Job[];
  cancel(id: string): void;
  getPendingCount(): number;
}
