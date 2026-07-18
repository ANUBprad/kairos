"""Shared fixtures and utilities for performance benchmarks."""

from __future__ import annotations

import os
import random
import string
import time
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class BenchmarkResult:
    name: str
    iterations: int
    times: list[float] = field(default_factory=list)
    memory_before: int = 0
    memory_after: int = 0

    @property
    def mean(self) -> float:
        return sum(self.times) / len(self.times) if self.times else 0.0

    @property
    def median(self) -> float:
        if not self.times:
            return 0.0
        s = sorted(self.times)
        n = len(s)
        if n % 2 == 0:
            return (s[n // 2 - 1] + s[n // 2]) / 2
        return s[n // 2]

    @property
    def p95(self) -> float:
        if not self.times:
            return 0.0
        s = sorted(self.times)
        idx = int(len(s) * 0.95)
        return s[min(idx, len(s) - 1)]

    @property
    def p99(self) -> float:
        if not self.times:
            return 0.0
        s = sorted(self.times)
        idx = int(len(s) * 0.99)
        return s[min(idx, len(s) - 1)]

    @property
    def min_time(self) -> float:
        return min(self.times) if self.times else 0.0

    @property
    def max_time(self) -> float:
        return max(self.times) if self.times else 0.0

    @property
    def std_dev(self) -> float:
        if len(self.times) < 2:
            return 0.0
        m = self.mean
        variance = sum((t - m) ** 2 for t in self.times) / (len(self.times) - 1)
        return variance ** 0.5

    @property
    def memory_delta_mb(self) -> float:
        return (self.memory_after - self.memory_before) / (1024 * 1024)

    def summary(self) -> dict:
        return {
            "name": self.name,
            "iterations": self.iterations,
            "mean_ms": round(self.mean * 1000, 3),
            "median_ms": round(self.median * 1000, 3),
            "p95_ms": round(self.p95 * 1000, 3),
            "p99_ms": round(self.p99 * 1000, 3),
            "min_ms": round(self.min_time * 1000, 3),
            "max_ms": round(self.max_time * 1000, 3),
            "std_dev_ms": round(self.std_dev * 1000, 3),
            "memory_delta_mb": round(self.memory_delta_mb, 2),
        }


def generate_random_text(num_chars: int) -> str:
    return "".join(random.choices(string.ascii_letters + " " + "\n", k=num_chars))


def generate_sentences(count: int, words_per_sentence: int = 15) -> list[str]:
    words = [
        "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
        "research", "shows", "that", "machine", "learning", "is", "transforming",
        "document", "analysis", "through", "retrieval", "augmented", "generation",
        "techniques", "enable", "better", "understanding", "of", "complex", "texts",
        "and", "improve", "accuracy", "of", "natural", "language", "processing",
        "systems", "by", "leveraging", "external", "knowledge", "bases",
    ]
    sentences = []
    for _ in range(count):
        sent_words = [random.choice(words) for _ in range(words_per_sentence)]
        sentences.append(" ".join(sent_words) + ".")
    return sentences


def generate_documents(count: int, chars_per_doc: int = 5000) -> list[str]:
    return [generate_random_text(chars_per_doc) for _ in range(count)]


def time_operation(func: Callable, *args, iterations: int = 100, **kwargs) -> BenchmarkResult:
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        func(*args, **kwargs)
        end = time.perf_counter()
        times.append(end - start)
    return BenchmarkResult(name=func.__name__, iterations=iterations, times=times)


def get_memory_usage_mb() -> float:
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except ImportError:
        return 0.0
