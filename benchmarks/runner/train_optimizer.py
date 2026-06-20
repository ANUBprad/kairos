"""Generate budget dataset, train optimizer, and produce report."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intelligence.optimization.budget_dataset import BudgetDatasetGenerator, BudgetDatasetEntry
from intelligence.optimization.budget_optimizer import BudgetOptimizer
from intelligence.optimization.optimization_storage import save_optimizer
from intelligence.optimization.optimization_metrics import generate_optimization_report

CALIB_PATH = "benchmarks/results/calibration_dataset.jsonl"
BUDGET_PATH = "benchmarks/results/budget_dataset.jsonl"
MODEL_PATH = "benchmarks/models/optimizer.json"
REPORT_PATH = "benchmarks/reports/optimization_report.md"

print("=" * 60)
print("BUDGET OPTIMIZATION TRAINING")
print("=" * 60)

# 1. Generate dataset
gen = BudgetDatasetGenerator()
entries = gen.generate(CALIB_PATH, BUDGET_PATH, augment=True)
print(f"Generated {len(entries)} budget dataset entries")

# 2. Load and train
entries_loaded: list = []
with open(BUDGET_PATH) as f:
    for line in f:
        if line.strip():
            d = json.loads(line)
            entries_loaded.append(BudgetDatasetEntry(**d))
print(f"Loaded {len(entries_loaded)} entries")

opt = BudgetOptimizer()
opt.fit(entries_loaded)
print(f"Fitted: {opt.fitted}")

# 3. Show learned table
stats = opt.get_stats()
print(f"Recommendations: {stats['num_recommendations']}")
table = stats["table"]
for qt in sorted(table):
    for cb in ["high", "medium", "low"]:
        rec = table[qt].get(cb)
        if rec:
            print(f"  {qt}/{cb}: top_k={rec['recommended_top_k']}, "
                  f"rerank={rec['recommended_rerank']}, "
                  f"decompose={rec['recommended_decompose']}, "
                  f"success={rec['expected_success']:.2%}")

# 4. Evaluate
eval_results = opt.evaluate(entries_loaded)
print(f"\nEvaluation:")
for k, v in eval_results.items():
    print(f"  {k}: {v}")

# 5. Save
save_optimizer(opt, MODEL_PATH)
print(f"\nOptimizer saved to {MODEL_PATH}")

# 6. Report
report = generate_optimization_report(opt, entries_loaded, eval_results)
with open(REPORT_PATH, "w", encoding="utf-8") as f:
    f.write(report)
print(f"Report saved to {REPORT_PATH}")
