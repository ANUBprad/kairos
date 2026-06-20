from __future__ import annotations

import logging
import time
from threading import Thread
from typing import Any, Callable, Dict, List, Optional

from .model_registry import ModelRegistry

logger = logging.getLogger(__name__)


class RetrainingScheduler:
    """Scheduler for periodic model retraining.

    The scheduler runs a retraining callback on a configurable interval,
    typically triggered by dataset size thresholds or time-based cadence.

    Usage::

        scheduler = RetrainingScheduler(
            retrain_fn=lambda records: retrainer.train(records),
            min_records=100,
            interval_hours=24,
        )
        scheduler.start()
        # ... later ...
        scheduler.stop()
    """

    def __init__(
        self,
        retrain_fn: Callable[[List[Dict[str, Any]]], Dict[str, Any]],
        registry: Optional[ModelRegistry] = None,
        min_records: int = 100,
        interval_hours: int = 24,
    ):
        self._retrain_fn = retrain_fn
        self._registry = registry or ModelRegistry()
        self._min_records = min_records
        self._interval_seconds = interval_hours * 3600
        self._thread: Optional[Thread] = None
        self._running = False
        self._last_run: Optional[float] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @property
    def last_run(self) -> Optional[float]:
        return self._last_run

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        """Start the retraining scheduler in a background thread."""
        if self._running:
            logger.warning("RetrainingScheduler already running")
            return
        self._running = True
        self._thread = Thread(target=self._loop, daemon=True, name="retrain-scheduler")
        self._thread.start()
        logger.info("RetrainingScheduler started (interval=%ds, min_records=%d)",
                     self._interval_seconds, self._min_records)

    def stop(self) -> None:
        """Stop the retraining scheduler."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("RetrainingScheduler stopped")

    def trigger(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Manually trigger a retraining run."""
        logger.info("Manual retraining triggered with %d records", len(records))
        if len(records) < self._min_records:
            logger.info("Skipping retraining: %d < %d min_records",
                        len(records), self._min_records)
            return {"skipped": True, "reason": f"Only {len(records)} records, need {self._min_records}"}
        result = self._retrain_fn(records)
        self._last_run = time.time()
        return result

    # ------------------------------------------------------------------
    # Internal loop
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        while self._running:
            time.sleep(self._interval_seconds)
            if not self._running:
                break
            logger.debug("Retraining cycle tick")
