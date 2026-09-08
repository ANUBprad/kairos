"""Run evaluation against a golden dataset.

Usage:
    python scripts/eval.py run --namespace local --dataset-name myds
    python scripts/eval.py run --dataset-path path/to/queries.json --namespace local

Requires the same infrastructure as the intelligence server (Chroma + an
LLM provider configured via environment variables).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from intelligence.evaluation.factory import run_dataset
from intelligence.evaluation.run_config import RunConfig


def run(args: argparse.Namespace) -> int:
    config = RunConfig(
        namespace=args.namespace,
        dataset_name=args.dataset_name,
        dataset_path=args.dataset_path,
        top_k=args.top_k,
        max_entries=args.max_entries,
    )
    result = run_dataset(
        config,
        dataset_path=args.dataset_path,
        use_llm_judges=args.llm_judges,
    )

    exit_code = 0

    if args.baseline:
        from intelligence.evaluation.regression import check_regression, save_baseline

        baseline_path = Path(args.baseline)
        if baseline_path.exists():
            check = check_regression(result, str(baseline_path), tolerances=args.tolerance)
            print(json.dumps(check.to_dict(), indent=2))
            if not check.passed:
                exit_code = 1
        else:
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
            save_baseline(result, str(baseline_path))
            print(f"Baseline saved to {baseline_path}")

    if args.gate:
        from intelligence.evaluation.quality_gate import QualityGateCondition, check_gate_on_run

        conditions = [
            QualityGateCondition(metric=metric, operator=operator, value=value)
            for metric, operator, value in args.gate
        ]
        check = check_gate_on_run(conditions, result)
        print(json.dumps(check.to_dict(), indent=2))
        if not check.passed:
            exit_code = 1

    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result.to_dict(), indent=2))
        print(f"Results written to {output}")
    else:
        payload = result.to_dict()
        print(json.dumps(payload, indent=2))

    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Kairos evaluation runner")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run a golden dataset evaluation")
    run_parser.add_argument("--namespace", required=True, help="Namespace for retrieved chunks")
    run_parser.add_argument("--dataset-name", default="default", help="Name of the dataset (informational)")
    run_parser.add_argument("--dataset-path", default=None, help="Path to queries.json (defaults to the shipped dataset)")
    run_parser.add_argument("--top-k", type=int, default=None, help="Number of chunks to retrieve per query (default: engine default)")
    run_parser.add_argument("--max-entries", type=int, default=None, help="Cap the number of queries evaluated")
    run_parser.add_argument("--llm-judges", action="store_true", help="Also run LLM-as-judge dimensions")
    run_parser.add_argument("--baseline", default=None, help="JSON baseline path: creates it on first run, gates on it afterwards")
    run_parser.add_argument("--tolerance", action="append", nargs=2, metavar=("METRIC", "VALUE"), help="Override a metric tolerance, e.g. --tolerance mean_recall 0.03")
    run_parser.add_argument("--gate", action="append", nargs=3, metavar=("METRIC", "OPERATOR", "VALUE"), help="Quality gate condition, e.g. --gate mean_recall gte 0.8 (repeatable; fails the run if any condition is unmet)")
    run_parser.add_argument("--output", default=None, help="Write results JSON to this path instead of stdout")

    args = parser.parse_args()
    if args.tolerance:
        args.tolerance = {metric: float(value) for metric, value in args.tolerance}
    if args.gate:
        args.gate = [(metric, operator, float(value)) for metric, operator, value in args.gate]
    return run(args)


if __name__ == "__main__":
    sys.exit(main())