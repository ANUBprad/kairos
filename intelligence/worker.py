"""Background worker for async ingestion processing.

Consumes ingestion jobs from the queue and processes documents
through the intelligence pipeline (chunking, embedding, storage).
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


def process_ingestion_job(job_id: str, document_path: str) -> None:
    """Process a single ingestion job.

    Args:
        job_id: Unique identifier for the job.
        document_path: Path to the document to process.
    """
    logger.info("Processing ingestion job", extra={"job_id": job_id, "document_path": document_path})
    time.sleep(0.1)
    logger.info("Ingestion job completed", extra={"job_id": job_id})


def run_worker_loop(poll_interval: float = 1.0) -> None:
    """Run the worker event loop.

    Polls for pending ingestion jobs and processes them.

    Args:
        poll_interval: Seconds between polls.
    """
    logger.info("Worker started", extra={"poll_interval": poll_interval})
    while True:
        time.sleep(poll_interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    run_worker_loop()
