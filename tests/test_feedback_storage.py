"""Tests for FeedbackStorage."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from intelligence.feedback.models import FeedbackRecord
from intelligence.feedback.storage import FeedbackStorage


@pytest.fixture
def sample_record() -> FeedbackRecord:
    return FeedbackRecord(
        query_id="q001",
        query="What is AI?",
        query_type="SIMPLE",
        retrieval_type="HYBRID",
        confidence=0.95,
        calibrated_confidence=0.92,
        top_k=3,
        rerank=False,
        decompose=False,
        answer_accepted=True,
        answer_rating=5,
        fallback_triggered=False,
        retrieval_success=True,
        latency_ms=12.5,
    )


@pytest.fixture
def temp_storage() -> FeedbackStorage:
    with tempfile.TemporaryDirectory() as tmp:
        yield FeedbackStorage(path=os.path.join(tmp, "feedback.jsonl"))


class TestFeedbackStorage:
    def test_append_and_load(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        records = list(temp_storage.load())
        assert len(records) == 1
        assert records[0].query_id == "q001"

    def test_append_batch(self, temp_storage, sample_record) -> None:
        records = [sample_record, sample_record]
        temp_storage.append_batch(records)
        loaded = list(temp_storage.load())
        assert len(loaded) == 2

    def test_append_batch_empty(self, temp_storage) -> None:
        temp_storage.append_batch([])
        assert temp_storage.count() == 0

    def test_count(self, temp_storage, sample_record) -> None:
        assert temp_storage.count() == 0
        temp_storage.append(sample_record)
        assert temp_storage.count() == 1

    def test_load_file_not_found(self, temp_storage) -> None:
        with pytest.raises(FileNotFoundError):
            list(temp_storage.load())

    def test_save_overwrites(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        r2 = FeedbackRecord(
            query_id="q002",
            query="test",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.8,
            calibrated_confidence=0.78,
            top_k=5,
            rerank=True,
            decompose=False,
            answer_accepted=False,
            answer_rating=2,
        )
        temp_storage.save([r2])
        records = list(temp_storage.load())
        assert len(records) == 1
        assert records[0].query_id == "q002"

    def test_clear(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        temp_storage.clear()
        assert temp_storage.count() == 0

    def test_round_trip_all_fields(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        records = list(temp_storage.load())
        r = records[0]
        assert r.query_id == "q001"
        assert r.answer_rating == 5
        assert r.answer_accepted
        assert r.retrieval_success
        assert r.latency_ms == 12.5

    def test_jsonl_format(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        path = Path(temp_storage._path)
        with path.open("r") as f:
            line = f.readline().strip()
        d = json.loads(line)
        assert d["query_id"] == "q001"
        assert d["answer_rating"] == 5

    def test_recovery_safe_save(self, temp_storage, sample_record) -> None:
        temp_storage.append(sample_record)
        records = list(temp_storage.load())
        assert len(records) == 1

    def test_count_empty_file(self, temp_storage) -> None:
        assert temp_storage.count() == 0
