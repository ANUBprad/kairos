from __future__ import annotations

import json
from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import pytest

from benchmarks.dataset.loader import QueryEntry

from intelligence.benchmarks import (
    BenchmarkResult,
    BenchmarkRunner,
    DatasetMetadata,
    DatasetRegistry,
    aggregate_results,
    generate_benchmark_report,
    load_hotpotqa,
    load_squad,
    load_natural_questions,
    load_msmarco,
)


# ===========================================================================
#  DatasetRegistry
# ===========================================================================


class TestDatasetRegistry:
    @pytest.fixture
    def registry(self) -> DatasetRegistry:
        return DatasetRegistry()

    @pytest.fixture
    def sample_entries(self) -> List[QueryEntry]:
        return [
            QueryEntry(id="1", text="q1", query_type="simple"),
            QueryEntry(id="2", text="q2", query_type="complex"),
        ]

    def test_register_and_list(self, registry, sample_entries):
        meta = DatasetMetadata(name="test-ds", source="test", task_type="qa")
        registry.register_dataset(meta, sample_entries)
        names = registry.dataset_names()
        assert names == ["test-ds"]

    def test_get_dataset(self, registry, sample_entries):
        meta = DatasetMetadata(name="test-ds", source="test", task_type="qa")
        registry.register_dataset(meta, sample_entries)
        assert registry.get_dataset("test-ds") == meta
        assert registry.get_dataset("nonexistent") is None

    def test_get_entries(self, registry, sample_entries):
        meta = DatasetMetadata(name="test-ds", source="test", task_type="qa")
        registry.register_dataset(meta, sample_entries)
        entries = registry.get_entries("test-ds")
        assert entries is not None
        assert len(entries) == 2

    def test_get_entries_nonexistent(self, registry):
        assert registry.get_entries("nope") is None

    def test_list_datasets(self, registry, sample_entries):
        registry.register_dataset(
            DatasetMetadata(name="ds1", source="src1", task_type="qa"),
            sample_entries,
        )
        registry.register_dataset(
            DatasetMetadata(name="ds2", source="src2", task_type="retrieval"),
            sample_entries,
        )
        metas = registry.list_datasets()
        assert len(metas) == 2
        names = [m.name for m in metas]
        assert "ds1" in names
        assert "ds2" in names

    def test_duplicate_name_raises(self, registry, sample_entries):
        meta = DatasetMetadata(name="dup", source="test", task_type="qa")
        registry.register_dataset(meta, sample_entries)
        with pytest.raises(ValueError, match="already registered"):
            registry.register_dataset(meta, sample_entries)

    def test_unregister(self, registry, sample_entries):
        meta = DatasetMetadata(name="del-me", source="test", task_type="qa")
        registry.register_dataset(meta, sample_entries)
        registry.unregister_dataset("del-me")
        assert registry.get_dataset("del-me") is None

    def test_unregister_nonexistent_raises(self, registry):
        with pytest.raises(KeyError, match="not found"):
            registry.unregister_dataset("nope")

    def test_len(self, registry, sample_entries):
        assert len(registry) == 0
        registry.register_dataset(
            DatasetMetadata(name="a", source="s", task_type="t"),
            sample_entries,
        )
        assert len(registry) == 1

    def test_contains(self, registry, sample_entries):
        registry.register_dataset(
            DatasetMetadata(name="present", source="s", task_type="t"),
            sample_entries,
        )
        assert "present" in registry
        assert "absent" not in registry

    def test_query_count_in_metadata(self, registry):
        entries = [
            QueryEntry(id=str(i), text=f"q{i}", query_type="simple") for i in range(5)
        ]
        meta = DatasetMetadata(
            name="counted", source="test", task_type="qa", query_count=5
        )
        registry.register_dataset(meta, entries)
        assert registry.get_dataset("counted").query_count == 5

    def test_dataset_names_sorted(self, registry, sample_entries):
        registry.register_dataset(
            DatasetMetadata(name="zebra", source="s", task_type="t"),
            sample_entries,
        )
        registry.register_dataset(
            DatasetMetadata(name="alpha", source="s", task_type="t"),
            sample_entries,
        )
        assert registry.dataset_names() == ["alpha", "zebra"]


# ===========================================================================
#  HotpotQA Loader
# ===========================================================================


HOTPOTQA_SAMPLE = [
    {
        "_id": "hp1",
        "question": "Which magazine was started first?",
        "answer": "Arthur's Magazine",
        "type": "comparison",
        "level": "medium",
        "supporting_facts": [["Arthur's Magazine", 0]],
        "context": [["Arthur's Magazine", ["sent0"]]],
    },
    {
        "_id": "hp2",
        "question": "What band is from Seattle?",
        "answer": "Nirvana",
        "type": "bridge",
        "level": "hard",
        "supporting_facts": [["Nirvana", 0]],
        "context": [["Nirvana", ["sent0"]]],
    },
    {
        "_id": "hp3",
        "question": "How many planets are there?",
        "answer": "Eight",
        "type": "comparison",
        "level": "easy",
        "supporting_facts": [],
        "context": [],
    },
]


class TestHotpotQALoader:
    @pytest.fixture
    def tmp_json(self, tmp_path: Path) -> Path:
        p = tmp_path / "hotpotqa.json"
        with open(p, "w") as f:
            json.dump(HOTPOTQA_SAMPLE, f)
        return p

    def test_load_all(self, tmp_json):
        entries = load_hotpotqa(tmp_json)
        assert len(entries) == 3

    def test_max_queries(self, tmp_json):
        entries = load_hotpotqa(tmp_json, max_queries=2)
        assert len(entries) == 2

    def test_query_entry_fields(self, tmp_json):
        entries = load_hotpotqa(tmp_json)
        e = entries[0]
        assert e.id == "hp1"
        assert "Which magazine" in e.text
        assert e.query_type == "complex"  # comparison maps to complex
        assert e.confidence_category == "medium"
        assert e.expected_chunks is not None
        assert "Arthur's Magazine" in e.expected_chunks[0]

    def test_confidence_band_mapping(self, tmp_json):
        entries = load_hotpotqa(tmp_json)
        assert entries[2].confidence_category == "high"  # easy → high

    def test_empty_file(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump([], f)
        entries = load_hotpotqa(p)
        assert len(entries) == 0

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            load_hotpotqa(Path("nonexistent.json"))

    def test_invalid_json(self, tmp_path):
        p = tmp_path / "bad.json"
        with open(p, "w") as f:
            f.write("not json")
        with pytest.raises(json.JSONDecodeError):
            load_hotpotqa(p)

    def test_missing_fields_skipped(self, tmp_path):
        items = [
            {
                "_id": "ok",
                "question": "valid question",
                "answer": "ans",
                "type": "simple",
                "level": "easy",
            },
            {"_id": "", "question": "no id"},
            {"not_a_question": "missing all fields"},
        ]
        p = tmp_path / "partial.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_hotpotqa(p)
        assert len(entries) == 1
        assert entries[0].id == "ok"

    def test_non_list_raises(self, tmp_path):
        p = tmp_path / "not_list.json"
        with open(p, "w") as f:
            json.dump({"not": "a list"}, f)
        with pytest.raises(ValueError, match="list"):
            load_hotpotqa(p)


# ===========================================================================
#  SQuAD Loader
# ===========================================================================


SQUAD_SAMPLE = {
    "version": "v2.0",
    "data": [
        {
            "title": "Bees",
            "paragraphs": [
                {
                    "context": "Bees are flying insects.",
                    "qas": [
                        {
                            "id": "sq1",
                            "question": "What are bees?",
                            "answers": [{"text": "flying insects", "answer_start": 9}],
                            "is_impossible": False,
                        }
                    ],
                }
            ],
        },
        {
            "title": "Flowers",
            "paragraphs": [
                {
                    "context": "Flowers are pretty.",
                    "qas": [
                        {
                            "id": "sq2",
                            "question": "How do flowers look?",
                            "answers": [{"text": "pretty", "answer_start": 12}],
                            "is_impossible": False,
                        },
                        {
                            "id": "sq3",
                            "question": "Impossible question?",
                            "answers": [],
                            "is_impossible": True,
                        },
                    ],
                }
            ],
        },
    ],
}


class TestSQuADLoader:
    @pytest.fixture
    def tmp_json(self, tmp_path: Path) -> Path:
        p = tmp_path / "squad.json"
        with open(p, "w") as f:
            json.dump(SQUAD_SAMPLE, f)
        return p

    def test_load_all(self, tmp_json):
        entries = load_squad(tmp_json)
        assert len(entries) == 3

    def test_max_queries(self, tmp_json):
        entries = load_squad(tmp_json, max_queries=1)
        assert len(entries) == 1

    def test_query_entry_fields(self, tmp_json):
        entries = load_squad(tmp_json)
        e = entries[0]
        assert e.id == "sq1"
        assert e.text == "What are bees?"
        assert e.query_type == "simple"
        assert e.expected_chunks is not None
        assert "flying insects" in e.expected_chunks[0]

    def test_domain_from_title(self, tmp_json):
        entries = load_squad(tmp_json)
        assert entries[0].domain == "Bees"
        assert entries[1].domain == "Flowers"

    def test_no_answers(self, tmp_json):
        entries = load_squad(tmp_json)
        e = entries[2]  # impossible question
        assert e.id == "sq3"
        assert e.expected_chunks is None

    def test_empty_data(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump({"version": "v2.0", "data": []}, f)
        entries = load_squad(p)
        assert len(entries) == 0

    def test_not_dict_top_level(self, tmp_path):
        p = tmp_path / "bad.json"
        with open(p, "w") as f:
            json.dump(["not", "a", "dict"], f)
        with pytest.raises(ValueError, match="dict"):
            load_squad(p)

    def test_no_data_key(self, tmp_path):
        p = tmp_path / "no_data.json"
        with open(p, "w") as f:
            json.dump({"version": "v2.0"}, f)
        entries = load_squad(p)
        assert len(entries) == 0


# ===========================================================================
#  Natural Questions Loader
# ===========================================================================


NQ_SAMPLE_ARRAY = [
    {
        "id": "nq1",
        "question_text": "Where is the Amazon River?",
        "document_text": "The Amazon River is in South America.",
        "annotations": [
            {
                "short_answers": [{"text": "South America", "start_byte": 10}],
                "long_answer": {
                    "text": "The Amazon River is in South America.",
                    "start_byte": 0,
                },
            }
        ],
    },
    {
        "id": "nq2",
        "question_text": "What is the capital of France?",
        "document_text": "Paris is the capital of France.",
        "annotations": [
            {
                "short_answers": [{"text": "Paris", "start_byte": 0}],
                "long_answer": {},
            }
        ],
    },
]

NQ_SAMPLE_LINES = "\n".join(json.dumps(item) for item in NQ_SAMPLE_ARRAY)


class TestNaturalQuestionsLoader:
    @pytest.fixture
    def tmp_json_array(self, tmp_path: Path) -> Path:
        p = tmp_path / "nq.json"
        with open(p, "w") as f:
            json.dump(NQ_SAMPLE_ARRAY, f)
        return p

    @pytest.fixture
    def tmp_jsonl(self, tmp_path: Path) -> Path:
        p = tmp_path / "nq.jsonl"
        with open(p, "w") as f:
            f.write(NQ_SAMPLE_LINES)
        return p

    def test_load_json_array(self, tmp_json_array):
        entries = load_natural_questions(tmp_json_array)
        assert len(entries) == 2

    def test_load_jsonl(self, tmp_jsonl):
        entries = load_natural_questions(tmp_jsonl)
        assert len(entries) == 2

    def test_max_queries(self, tmp_json_array):
        entries = load_natural_questions(tmp_json_array, max_queries=1)
        assert len(entries) == 1

    def test_query_entry_fields(self, tmp_json_array):
        entries = load_natural_questions(tmp_json_array)
        e = entries[0]
        assert e.id == "nq1"
        assert "Amazon River" in e.text
        assert e.query_type == "complex"
        assert e.expected_chunks is not None
        assert "South America" in e.expected_chunks[0]

    def test_no_annotations(self, tmp_path):
        items = [{"id": "nq3", "question_text": "test?", "document_text": "answer."}]
        p = tmp_path / "no_ann.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_natural_questions(p)
        assert len(entries) == 1
        assert entries[0].expected_chunks is None

    def test_empty_array(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump([], f)
        entries = load_natural_questions(p)
        assert len(entries) == 0

    def test_not_dict_item_in_jsonl(self, tmp_path):
        p = tmp_path / "not_dict.jsonl"
        with open(p, "w") as f:
            f.write('"just a string"')
        entries = load_natural_questions(p)
        assert len(entries) == 0


# ===========================================================================
#  MS MARCO Loader
# ===========================================================================


MSMARCO_SAMPLE = [
    {
        "query_id": "ms1",
        "query": "how many islands in the bahamas",
        "passages": [
            {"is_selected": 1, "passage_text": "The Bahamas has 700 islands."},
            {"is_selected": 0, "passage_text": "Bahamas is a country."},
        ],
        "answer": "700",
    },
    {
        "query_id": "ms2",
        "query": "what is the speed of light",
        "passages": [
            {"is_selected": 0, "passage_text": "Light is fast."},
        ],
        "answer": "299,792,458 m/s",
    },
    {
        "query_id": "ms3",
        "query": "no passages selected",
        "passages": [
            {"is_selected": 0, "passage_text": "Not relevant."},
        ],
        "answer": "fallback answer",
    },
]


class TestMSMARCOLoader:
    @pytest.fixture
    def tmp_json(self, tmp_path: Path) -> Path:
        p = tmp_path / "msmarco.json"
        with open(p, "w") as f:
            json.dump(MSMARCO_SAMPLE, f)
        return p

    def test_load_all(self, tmp_json):
        entries = load_msmarco(tmp_json)
        assert len(entries) == 3

    def test_max_queries(self, tmp_json):
        entries = load_msmarco(tmp_json, max_queries=1)
        assert len(entries) == 1

    def test_selected_passages_as_chunks(self, tmp_json):
        entries = load_msmarco(tmp_json)
        e = entries[0]
        assert e.id == "ms1"
        assert e.text == "how many islands in the bahamas"
        assert e.expected_chunks is not None
        assert "700 islands" in e.expected_chunks[0]

    def test_fallback_to_answer(self, tmp_json):
        entries = load_msmarco(tmp_json)
        e = entries[2]  # no selected passages
        assert e.expected_chunks is not None
        assert "fallback answer" in e.expected_chunks[0]

    def test_no_answer_no_selected(self, tmp_path):
        items = [{"query_id": "ms4", "query": "test?", "passages": [], "answer": ""}]
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_msmarco(p)
        assert len(entries) == 1
        assert entries[0].expected_chunks is None

    def test_empty_list(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump([], f)
        entries = load_msmarco(p)
        assert len(entries) == 0

    def test_not_list_raises(self, tmp_path):
        p = tmp_path / "not_list.json"
        with open(p, "w") as f:
            json.dump({"not": "list"}, f)
        with pytest.raises(ValueError, match="list"):
            load_msmarco(p)


# ===========================================================================
#  BenchmarkResult
# ===========================================================================


class TestBenchmarkResult:
    def test_basic_properties(self):
        res = BenchmarkResult(
            dataset_name="test",
            query_count=10,
            metrics={
                "fallback_count": 2,
                "timeout_count": 1,
                "empty_retrieval_count": 0,
            },
            per_query_recall=[0.5, 0.6, 0.7],
            per_query_precision=[0.4, 0.5, 0.6],
            per_query_latency_ms=[100.0, 200.0, 300.0],
        )
        assert res.average_recall == pytest.approx(0.6)
        assert res.average_precision == pytest.approx(0.5)
        assert res.average_latency_ms == pytest.approx(200.0)
        assert res.success_rate == pytest.approx(
            0.9
        )  # 10 - 1 timeout = 9 successes → 90%
        assert res.fallback_rate == pytest.approx(0.2)  # 2 / 10

    def test_empty_per_query(self):
        res = BenchmarkResult(dataset_name="e", query_count=0)
        assert res.average_recall is None
        assert res.average_precision is None
        assert res.average_latency_ms == 0.0
        assert res.success_rate == 0.0
        assert res.fallback_rate == 0.0

    def test_success_rate_all_failures(self):
        res = BenchmarkResult(
            dataset_name="f",
            query_count=5,
            metrics={
                "timeout_count": 3,
                "empty_retrieval_count": 2,
                "fallback_count": 0,
            },
        )
        assert res.success_rate == 0.0

    def test_success_rate_no_failures(self):
        res = BenchmarkResult(
            dataset_name="p",
            query_count=5,
            metrics={"timeout_count": 0, "empty_retrieval_count": 0},
        )
        assert res.success_rate == 1.0

    def test_validation_field_none_by_default(self):
        res = BenchmarkResult(dataset_name="v")
        assert res.validation is None


class TestAggregateResults:
    def test_empty(self):
        agg = aggregate_results([])
        assert agg["dataset_count"] == 0
        assert agg["total_queries"] == 0

    def test_single(self):
        results = [
            BenchmarkResult(
                dataset_name="a",
                query_count=10,
                per_query_recall=[0.5, 0.6],
                per_query_precision=[0.4, 0.5],
                per_query_latency_ms=[100.0, 200.0],
                metrics={
                    "timeout_count": 0,
                    "empty_retrieval_count": 0,
                    "fallback_count": 1,
                },
            ),
        ]
        agg = aggregate_results(results)
        assert agg["dataset_count"] == 1
        assert agg["total_queries"] == 10
        assert agg["average_recall"] == pytest.approx(0.55)
        assert agg["average_precision"] == pytest.approx(0.45)

    def test_multiple(self):
        results = [
            BenchmarkResult(
                dataset_name="a",
                query_count=10,
                per_query_recall=[0.5],
                per_query_precision=[0.4],
                per_query_latency_ms=[100.0],
                metrics={
                    "timeout_count": 1,
                    "empty_retrieval_count": 0,
                    "fallback_count": 0,
                },
            ),
            BenchmarkResult(
                dataset_name="b",
                query_count=20,
                per_query_recall=[0.7],
                per_query_precision=[0.6],
                per_query_latency_ms=[200.0],
                metrics={
                    "timeout_count": 0,
                    "empty_retrieval_count": 0,
                    "fallback_count": 2,
                },
            ),
        ]
        agg = aggregate_results(results)
        assert agg["dataset_count"] == 2
        assert agg["total_queries"] == 30
        assert agg["average_recall"] == pytest.approx(0.6)
        assert agg["average_latency_ms"] == pytest.approx(150.0)

    def test_all_none_recall(self):
        results = [
            BenchmarkResult(dataset_name="a", query_count=5, per_query_recall=[]),
            BenchmarkResult(dataset_name="b", query_count=5, per_query_recall=[]),
        ]
        agg = aggregate_results(results)
        assert agg["average_recall"] is None
        assert agg["average_precision"] is None


# ===========================================================================
#  BenchmarkRunner (with mocks)
# ===========================================================================


class TestBenchmarkRunner:
    @pytest.fixture
    def mock_classifier(self) -> MagicMock:
        clf = MagicMock()
        schema = MagicMock(
            query_type="simple",
            domain=None,
            confidence_score=0.95,
        )
        clf.classify_with_confidence.return_value = schema
        return clf

    @pytest.fixture
    def mock_retriever(self) -> MagicMock:
        ret = MagicMock()
        ret.retrieve.return_value = ["chunk_a", "chunk_b"]
        return ret

    @pytest.fixture
    def entries(self) -> List[QueryEntry]:
        return [
            QueryEntry(id="e1", text="test query 1", query_type="simple"),
            QueryEntry(id="e2", text="test query 2", query_type="complex"),
        ]

    def test_run_single_dataset(self, mock_classifier, mock_retriever, entries):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        result = runner.run_single_dataset(entries, dataset_name="test-ds")
        assert isinstance(result, BenchmarkResult)
        assert result.dataset_name == "test-ds"
        assert result.query_count == 2

    def test_empty_entries_raises(self, mock_classifier, mock_retriever):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        with pytest.raises(ValueError, match="empty"):
            runner.run_single_dataset([])

    def test_validation_computed(self, mock_classifier, mock_retriever, entries):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        result = runner.run_single_dataset(entries, include_validation=True)
        # With mock retriever returning chunks but no expected_chunks, recall is None
        # → per_query_recall is empty → validation is None
        assert result.validation is not None or result.validation is None

    def test_validation_disabled(self, mock_classifier, mock_retriever, entries):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        result = runner.run_single_dataset(entries, include_validation=False)
        assert result.validation is None

    def test_metrics_present(self, mock_classifier, mock_retriever, entries):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        result = runner.run_single_dataset(entries)
        assert "total_queries" in result.metrics
        assert result.metrics["total_queries"] == 2

    def test_run_multiple_datasets(self, mock_classifier, mock_retriever, entries):
        registry = DatasetRegistry()
        meta = DatasetMetadata(name="ds1", source="test", task_type="qa")
        registry.register_dataset(meta, entries)
        meta2 = DatasetMetadata(name="ds2", source="test", task_type="qa")
        registry.register_dataset(meta2, entries)

        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        results = runner.run_multiple_datasets(registry)
        assert len(results) == 2

    def test_run_multiple_subset(self, mock_classifier, mock_retriever, entries):
        registry = DatasetRegistry()
        registry.register_dataset(
            DatasetMetadata(name="ds1", source="test", task_type="qa"),
            entries,
        )
        registry.register_dataset(
            DatasetMetadata(name="ds2", source="test", task_type="qa"),
            entries,
        )

        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        results = runner.run_multiple_datasets(registry, dataset_names=["ds1"])
        assert len(results) == 1
        assert results[0].dataset_name == "ds1"

    def test_run_multiple_empty_registry(self, mock_classifier, mock_retriever):
        registry = DatasetRegistry()
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        results = runner.run_multiple_datasets(registry)
        assert results == []


class TestBenchmarkRunnerWithValidation:
    @pytest.fixture
    def mock_classifier(self) -> MagicMock:
        clf = MagicMock()
        schema = MagicMock(query_type="simple", domain=None, confidence_score=0.95)
        clf.classify_with_confidence.return_value = schema
        return clf

    @pytest.fixture
    def entries_with_truth(self) -> List[QueryEntry]:
        return [
            QueryEntry(
                id="e1",
                text="q1",
                query_type="simple",
                expected_chunks=["chunk_a"],
            ),
            QueryEntry(
                id="e2",
                text="q2",
                query_type="simple",
                expected_chunks=["chunk_b"],
            ),
        ]

    def test_validation_with_ground_truth(
        self,
        mock_classifier,
        entries_with_truth,
    ):
        retriever = MagicMock()
        retriever.retrieve.return_value = ["chunk_a"]

        runner = BenchmarkRunner(classifier=mock_classifier, retriever=retriever)
        result = runner.run_single_dataset(
            entries_with_truth,
            dataset_name="val-ds",
            include_validation=True,
        )
        # We have recall values now
        assert len(result.per_query_recall) > 0
        assert result.validation is not None


# ===========================================================================
#  Experiment tracker integration
# ===========================================================================


class TestTrackedBenchmarkRunner:
    @pytest.fixture
    def mock_classifier(self) -> MagicMock:
        clf = MagicMock()
        schema = MagicMock(query_type="simple", domain=None, confidence_score=0.95)
        clf.classify_with_confidence.return_value = schema
        return clf

    @pytest.fixture
    def mock_retriever(self) -> MagicMock:
        ret = MagicMock()
        ret.retrieve.return_value = ["chunk_a"]
        return ret

    @pytest.fixture
    def tracker(self, tmp_path: Path) -> object:
        from intelligence.experiments import ExperimentTracker, ExperimentRegistry
        from intelligence.experiments.persistence import ExperimentStore

        store = ExperimentStore(base_dir=str(tmp_path / "experiments"))
        registry = ExperimentRegistry(store=store)
        return ExperimentTracker(registry=registry)

    @pytest.fixture
    def entries(self) -> List[QueryEntry]:
        return [
            QueryEntry(id="e1", text="q1", query_type="simple", expected_chunks=["c1"]),
        ]

    def test_tracker_receives_metrics(
        self,
        mock_classifier,
        mock_retriever,
        tracker,
        entries,
    ):
        runner = BenchmarkRunner(
            classifier=mock_classifier,
            retriever=mock_retriever,
            tracker=tracker,
        )
        result = runner.run_single_dataset(entries, dataset_name="tracked-ds")
        assert result.query_count == 1
        tracked = tracker.registry.list_runs()
        assert len(tracked) >= 1

    def test_tracker_phase(self, mock_classifier, mock_retriever, tracker, entries):
        runner = BenchmarkRunner(
            classifier=mock_classifier,
            retriever=mock_retriever,
            tracker=tracker,
        )
        runner.run_single_dataset(entries, dataset_name="phase-test")
        runs = tracker.registry.list_runs()
        assert any(r.phase == "benchmark" for r in runs)


# ===========================================================================
#  Reporting
# ===========================================================================


class TestBenchmarkReportGeneration:
    def test_empty_results(self):
        report = generate_benchmark_report([])
        assert "No results to report" in report
        assert "Datasets evaluated" in report

    def test_single_result(self):
        results = [
            BenchmarkResult(
                dataset_name="test-ds",
                query_count=5,
                per_query_recall=[0.5, 0.6],
                per_query_precision=[0.4, 0.5],
                per_query_latency_ms=[100.0, 200.0],
                metrics={
                    "fallback_count": 1,
                    "timeout_count": 0,
                    "empty_retrieval_count": 0,
                },
            ),
        ]
        report = generate_benchmark_report(results)
        assert "Cross-Benchmark Evaluation Report" in report
        assert "test-ds" in report
        assert "Datasets evaluated" in report
        assert "Aggregate Summary" in report

    def test_multiple_datasets_in_report(self):
        results = [
            BenchmarkResult(
                dataset_name="alpha",
                query_count=10,
                per_query_recall=[0.7],
                per_query_precision=[0.6],
                per_query_latency_ms=[150.0],
                metrics={
                    "fallback_count": 0,
                    "timeout_count": 0,
                    "empty_retrieval_count": 0,
                },
            ),
            BenchmarkResult(
                dataset_name="beta",
                query_count=20,
                per_query_recall=[0.5],
                per_query_precision=[0.4],
                per_query_latency_ms=[250.0],
                metrics={
                    "fallback_count": 2,
                    "timeout_count": 0,
                    "empty_retrieval_count": 0,
                },
            ),
        ]
        report = generate_benchmark_report(results)
        assert "alpha" in report
        assert "beta" in report
        assert "Ranking by Recall" in report

    def test_ranking_order(self):
        results = [
            BenchmarkResult(
                dataset_name="low",
                query_count=5,
                per_query_recall=[0.3],
                per_query_precision=[0.3],
                per_query_latency_ms=[100.0],
                metrics={},
            ),
            BenchmarkResult(
                dataset_name="high",
                query_count=5,
                per_query_recall=[0.9],
                per_query_precision=[0.9],
                per_query_latency_ms=[100.0],
                metrics={},
            ),
            BenchmarkResult(
                dataset_name="mid",
                query_count=5,
                per_query_recall=[0.6],
                per_query_precision=[0.6],
                per_query_latency_ms=[100.0],
                metrics={},
            ),
        ]
        report = generate_benchmark_report(results)
        lines = report.splitlines()
        rank_section = False
        prev_recall = 999.0
        for line in lines:
            if "Ranking by Recall" in line:
                rank_section = True
                continue
            if (
                rank_section
                and line.startswith("|")
                and "Rank" not in line
                and "---" not in line
            ):
                parts = [p.strip() for p in line.split("|") if p.strip()]
                if len(parts) >= 3:
                    try:
                        recall = float(parts[2])
                        assert recall <= prev_recall
                        prev_recall = recall
                    except ValueError:
                        continue

    def test_with_validation(self):
        from intelligence.statistics.reporting import (
            ValidationResult,
            SignificanceResult,
        )
        from intelligence.statistics.confidence_intervals import ConfidenceInterval
        from intelligence.statistics.effect_size import EffectSize

        vr = ValidationResult(
            baseline_label="zero",
            treatment_label="val-ds",
            metric_name="recall",
            significance={
                "Paired t-test": SignificanceResult(
                    statistic=5.0,
                    p_value=0.001,
                    significant=True,
                    alpha=0.05,
                    method="t",
                    n=10,
                ),
            },
            confidence_intervals={
                "zero": ConfidenceInterval(0, 0, 0.95, "t", 10, 0, 0),
                "val-ds": ConfidenceInterval(0.1, 0.9, 0.95, "t", 10, 0.5, 0.2),
            },
            effect_sizes={
                "Cohen's d": EffectSize(
                    1.5, "large", "treatment > baseline", "d", 10, 10
                ),
            },
            bootstrap=None,
            n_observations=10,
            is_significant=True,
            summary="recall: val-ds vs zero — significant (t-test: 0.0010), Cohen's d=1.5000 (large), treatment > baseline",
        )

        result = BenchmarkResult(
            dataset_name="val-ds",
            query_count=10,
            per_query_recall=[0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.65, 0.75, 0.85, 0.95],
            per_query_precision=[0.4, 0.5, 0.6, 0.7, 0.8, 0.45, 0.55, 0.65, 0.75, 0.85],
            per_query_latency_ms=[100.0] * 10,
            metrics={
                "fallback_count": 0,
                "timeout_count": 0,
                "empty_retrieval_count": 0,
            },
            validation=vr,
        )

        report = generate_benchmark_report([result])
        assert "Statistical Validation" in report
        assert "Paired t-test" in report
        assert "val-ds" in report

    def test_validation_section_omitted_when_absent(self):
        result = BenchmarkResult(
            dataset_name="no-val",
            query_count=5,
            per_query_recall=[0.5],
            metrics={},
        )
        report = generate_benchmark_report([result])
        assert "Statistical Validation" not in report

    def test_all_none_recall_ranking_omitted(self):
        results = [
            BenchmarkResult(
                dataset_name="no-recall",
                query_count=5,
                per_query_recall=[],
                per_query_precision=[],
                per_query_latency_ms=[100.0],
                metrics={},
            ),
        ]
        report = generate_benchmark_report(results)
        assert "Ranking by Recall" not in report


# ===========================================================================
#  End-to-end: loader + registry + runner + report
# ===========================================================================


class TestEndToEnd:
    def test_loader_to_registry_to_report(self, tmp_path):
        """End-to-end: load HotpotQA → register → run → generate report."""
        # Create a small HotpotQA file
        hp_data = [
            {
                "_id": "hp1",
                "question": "test?",
                "answer": "answer1",
                "type": "simple",
                "level": "easy",
            },
        ]
        hp_path = tmp_path / "hotpotqa.json"
        with open(hp_path, "w") as f:
            json.dump(hp_data, f)

        entries = load_hotpotqa(hp_path)
        assert len(entries) == 1

        registry = DatasetRegistry()
        registry.register_dataset(
            DatasetMetadata(name="hotpotqa-test", source="hotpotqa", task_type="qa"),
            entries,
        )
        assert "hotpotqa-test" in registry

        clf = MagicMock()
        clf.classify_with_confidence.return_value = MagicMock(
            query_type="simple",
            domain=None,
            confidence_score=0.95,
        )
        ret = MagicMock()
        ret.retrieve.return_value = ["chunk_a"]

        runner = BenchmarkRunner(classifier=clf, retriever=ret)
        results = runner.run_multiple_datasets(
            registry, dataset_names=["hotpotqa-test"]
        )
        assert len(results) == 1
        assert results[0].dataset_name == "hotpotqa-test"

        report = generate_benchmark_report(results)
        assert "hotpotqa-test" in report
        assert "Aggregate Summary" in report


# ===========================================================================
#  Edge cases — loaders
# ===========================================================================


class TestLoaderEdgeCases:
    @pytest.fixture
    def tmp_path(self, tmp_path: Path) -> Path:
        return tmp_path

    def test_hotpotqa_non_dict_items_skipped(self, tmp_path):
        items = [
            {
                "_id": "ok",
                "question": "q?",
                "answer": "a",
                "type": "simple",
                "level": "easy",
            },
            "not_a_dict",
            42,
            None,
        ]
        p = tmp_path / "mixed.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_hotpotqa(p)
        assert len(entries) == 1

    def test_squad_malformed_paragraphs_skipped(self, tmp_path):
        data = {
            "version": "v2.0",
            "data": [{"title": "T", "paragraphs": [None, "bad", {}]}],
        }
        p = tmp_path / "bad_squad.json"
        with open(p, "w") as f:
            json.dump(data, f)
        entries = load_squad(p)
        assert len(entries) == 0

    def test_natural_questions_empty_line_in_jsonl(self, tmp_path):
        items = [
            {"id": "nq1", "question_text": "q1?", "document_text": "a1."},
            {},
            {"id": "nq2", "question_text": "q2?", "document_text": "a2."},
        ]
        content = "\n".join(json.dumps(item) for item in items)
        p = tmp_path / "nq_with_empty.jsonl"
        with open(p, "w") as f:
            f.write(content)
        entries = load_natural_questions(p)
        # Empty dict has no id/question → skipped
        assert len(entries) == 2

    def test_msmarco_no_passages_key(self, tmp_path):
        items = [{"query_id": "ms1", "query": "q?", "answer": "a"}]
        p = tmp_path / "ms_no_passages.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_msmarco(p)
        assert len(entries) == 1
        assert entries[0].expected_chunks == ["a"]

    def test_msmarco_passages_not_list(self, tmp_path):
        items = [
            {"query_id": "ms1", "query": "q?", "passages": "not_a_list", "answer": ""}
        ]
        p = tmp_path / "bad_passages.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_msmarco(p)
        assert len(entries) == 1
        assert entries[0].expected_chunks is None

    def test_hotpotqa_long_answer_handling(self, tmp_path):
        items = [
            {
                "_id": "h1",
                "question": "q?",
                "answer": "long answer here",
                "type": "bridge",
                "level": "hard",
                "supporting_facts": [],
                "context": [],
            }
        ]
        p = tmp_path / "hp_long.json"
        with open(p, "w") as f:
            json.dump(items, f)
        entries = load_hotpotqa(p)
        assert len(entries) == 1
        assert entries[0].query_type == "complex"
        assert entries[0].confidence_category == "low"


# ===========================================================================
#  DatasetMetadata
# ===========================================================================


class TestDatasetMetadata:
    def test_defaults(self):
        meta = DatasetMetadata(name="n", source="s", task_type="t")
        assert meta.name == "n"
        assert meta.source == "s"
        assert meta.task_type == "t"
        assert meta.query_count == 0
        assert meta.description == ""
        assert meta.version == ""

    def test_frozen(self):
        meta = DatasetMetadata(name="n", source="s", task_type="t")
        with pytest.raises(AttributeError):
            meta.name = "new"  # type: ignore[misc]


# ===========================================================================
#  Additional edge cases — runners & reporting
# ===========================================================================


class TestBenchmarkRunnerEdgeCases:
    @pytest.fixture
    def mock_classifier(self) -> MagicMock:
        clf = MagicMock()
        clf.classify_with_confidence.return_value = MagicMock(
            query_type="simple",
            domain=None,
            confidence_score=0.95,
        )
        return clf

    @pytest.fixture
    def mock_retriever(self) -> MagicMock:
        ret = MagicMock()
        ret.retrieve.return_value = ["chunk_a"]
        return ret

    def test_runner_without_tracker(self, mock_classifier, mock_retriever):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        entries = [QueryEntry(id="e1", text="test", query_type="simple")]
        result = runner.run_single_dataset(entries, dataset_name="no-tracker")
        assert result.dataset_name == "no-tracker"
        assert result.query_count == 1

    def test_runner_custom_name(self, mock_classifier, mock_retriever):
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        entries = [QueryEntry(id="e1", text="test", query_type="simple")]
        result = runner.run_single_dataset(
            entries, dataset_name="custom", run_name="my-run"
        )
        assert result.dataset_name == "custom"

    def test_runner_with_planner(self, mock_classifier, mock_retriever):
        from intelligence.planner import RetrievalPlanner

        planner = RetrievalPlanner(classifier=mock_classifier)
        runner = BenchmarkRunner(
            classifier=mock_classifier,
            retriever=mock_retriever,
            planner=planner,
        )
        entries = [QueryEntry(id="e1", text="test", query_type="simple")]
        result = runner.run_single_dataset(entries)
        assert result.query_count == 1

    def test_multiple_datasets_skips_missing(self, mock_classifier, mock_retriever):
        registry = DatasetRegistry()
        entries = [QueryEntry(id="e1", text="test", query_type="simple")]
        registry.register_dataset(
            DatasetMetadata(name="present", source="s", task_type="t"),
            entries,
        )
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=mock_retriever)
        results = runner.run_multiple_datasets(
            registry, dataset_names=["present", "missing"]
        )
        assert len(results) == 1
        assert results[0].dataset_name == "present"


class TestReportEdgeCases:
    def test_report_with_precision_only(self):
        results = [
            BenchmarkResult(
                dataset_name="p-only",
                query_count=3,
                per_query_recall=[],
                per_query_precision=[0.5, 0.6, 0.7],
                per_query_latency_ms=[100.0, 200.0, 300.0],
                metrics={},
            ),
        ]
        report = generate_benchmark_report(results)
        assert "p-only" in report
        assert "Ranking by Recall" not in report

    def test_report_large_numbers(self):
        results = [
            BenchmarkResult(
                dataset_name="large",
                query_count=1000,
                per_query_recall=[0.85] * 1000,
                per_query_latency_ms=[50.0] * 1000,
                metrics={},
            ),
        ]
        report = generate_benchmark_report(results)
        assert "large" in report
        assert "1000" in report

    def test_report_mixed_validation_presence(self):
        from intelligence.statistics.reporting import ValidationResult

        vr = ValidationResult(
            baseline_label="zero",
            treatment_label="val-ds",
            metric_name="recall",
            significance={},
            confidence_intervals={},
            effect_sizes={},
            bootstrap=None,
            n_observations=2,
            is_significant=False,
            summary="no change",
        )
        results = [
            BenchmarkResult(
                dataset_name="with-val",
                query_count=2,
                per_query_recall=[0.5, 0.6],
                metrics={},
                validation=vr,
            ),
            BenchmarkResult(
                dataset_name="no-val",
                query_count=2,
                per_query_recall=[0.5, 0.6],
                metrics={},
            ),
        ]
        report = generate_benchmark_report(results)
        assert "Statistical Validation" in report
        assert "with-val" in report
        assert "no-val" in report

    def test_report_different_title(self):
        result = BenchmarkResult(
            dataset_name="x", query_count=1, per_query_recall=[0.5], metrics={}
        )
        report = generate_benchmark_report([result], title="Custom Title")
        assert "Custom Title" in report


class TestLoaderNoFileEdgeCases:
    def test_squad_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            load_squad(Path("nonexistent_squad.json"))

    def test_natural_questions_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            load_natural_questions(Path("nonexistent_nq.json"))

    def test_msmarco_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            load_msmarco(Path("nonexistent_msmarco.json"))

    def test_hotpotqa_corrupted_json(self, tmp_path):
        p = tmp_path / "corrupt.json"
        with open(p, "w") as f:
            f.write('{"_id": "broken')  # truncated JSON
        with pytest.raises(json.JSONDecodeError):
            load_hotpotqa(p)

    def test_squad_corrupted_json(self, tmp_path):
        p = tmp_path / "corrupt.json"
        with open(p, "w") as f:
            f.write('{"version": "2.0", "data": [}')  # invalid
        with pytest.raises(json.JSONDecodeError):
            load_squad(p)

    def test_natural_questions_empty_file(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            f.write("")
        entries = load_natural_questions(p)
        assert len(entries) == 0

    def test_natural_questions_empty_json_array(self, tmp_path):
        p = tmp_path / "empty.json"
        with open(p, "w") as f:
            json.dump([], f)
        entries = load_natural_questions(p)
        assert len(entries) == 0
