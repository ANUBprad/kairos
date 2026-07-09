from __future__ import annotations


import numpy as np


def compute_ece(
    confidences: np.ndarray,
    successes: np.ndarray,
    n_bins: int = 10,
) -> float:
    confidences = np.asarray(confidences, dtype=float).ravel()
    successes = np.asarray(successes, dtype=float).ravel()

    if len(confidences) == 0:
        return 0.0

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(confidences, bin_boundaries, right=True) - 1
    bin_indices = np.clip(bin_indices, 0, n_bins - 1)

    ece = 0.0
    for i in range(n_bins):
        mask = bin_indices == i
        if mask.sum() == 0:
            continue

        bin_conf = confidences[mask].mean()
        bin_acc = successes[mask].mean()
        bin_weight = mask.sum() / len(confidences)
        ece += bin_weight * abs(bin_acc - bin_conf)

    return float(ece)


def compute_mce(
    confidences: np.ndarray,
    successes: np.ndarray,
    n_bins: int = 10,
) -> float:
    confidences = np.asarray(confidences, dtype=float).ravel()
    successes = np.asarray(successes, dtype=float).ravel()

    if len(confidences) == 0:
        return 0.0

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(confidences, bin_boundaries, right=True) - 1
    bin_indices = np.clip(bin_indices, 0, n_bins - 1)

    max_gap = 0.0
    for i in range(n_bins):
        mask = bin_indices == i
        if mask.sum() == 0:
            continue
        bin_conf = confidences[mask].mean()
        bin_acc = successes[mask].mean()
        gap = abs(bin_acc - bin_conf)
        if gap > max_gap:
            max_gap = gap

    return float(max_gap)


def compute_brier_score(
    confidences: np.ndarray,
    successes: np.ndarray,
) -> float:
    confidences = np.asarray(confidences, dtype=float).ravel()
    successes = np.asarray(successes, dtype=float).ravel()

    if len(confidences) == 0:
        return 0.0

    return float(np.mean((confidences - successes) ** 2))


def compute_reliability_diagram(
    confidences: np.ndarray,
    successes: np.ndarray,
    n_bins: int = 10,
) -> dict:
    confidences = np.asarray(confidences, dtype=float).ravel()
    successes = np.asarray(successes, dtype=float).ravel()

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(confidences, bin_boundaries, right=True) - 1
    bin_indices = np.clip(bin_indices, 0, n_bins - 1)

    bins = []
    for i in range(n_bins):
        mask = bin_indices == i
        count = int(mask.sum())
        if count == 0:
            bins.append(
                {
                    "bin_center": (bin_boundaries[i] + bin_boundaries[i + 1]) / 2,
                    "bin_lower": float(bin_boundaries[i]),
                    "bin_upper": float(bin_boundaries[i + 1]),
                    "count": 0,
                    "accuracy": 0.0,
                    "avg_confidence": 0.0,
                    "gap": 0.0,
                }
            )
            continue

        bin_acc = float(successes[mask].mean())
        bin_conf = float(confidences[mask].mean())
        bins.append(
            {
                "bin_center": (bin_boundaries[i] + bin_boundaries[i + 1]) / 2,
                "bin_lower": float(bin_boundaries[i]),
                "bin_upper": float(bin_boundaries[i + 1]),
                "count": count,
                "accuracy": bin_acc,
                "avg_confidence": bin_conf,
                "gap": bin_acc - bin_conf,
            }
        )

    return {
        "bins": bins,
        "n_total": len(confidences),
        "n_bins": n_bins,
    }


def compute_confidence_histogram(
    confidences: np.ndarray,
    successes: np.ndarray,
    n_bins: int = 10,
) -> dict:
    confidences = np.asarray(confidences, dtype=float).ravel()
    successes = np.asarray(successes, dtype=float).ravel()

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(confidences, bin_boundaries, right=True) - 1
    bin_indices = np.clip(bin_indices, 0, n_bins - 1)

    bins = []
    for i in range(n_bins):
        mask = bin_indices == i
        count = int(mask.sum())
        if count == 0:
            bins.append(
                {
                    "bin_center": (bin_boundaries[i] + bin_boundaries[i + 1]) / 2,
                    "count": 0,
                    "successes": 0,
                    "failures": 0,
                    "success_rate": 0.0,
                }
            )
            continue

        success_count = int(successes[mask].sum())
        bins.append(
            {
                "bin_center": (bin_boundaries[i] + bin_boundaries[i + 1]) / 2,
                "count": count,
                "successes": success_count,
                "failures": count - success_count,
                "success_rate": float(successes[mask].mean()),
            }
        )

    return {
        "bins": bins,
        "n_total": len(confidences),
        "n_bins": n_bins,
    }


def generate_calibration_report(
    confidences: np.ndarray,
    successes: np.ndarray,
    calibrated_confidences: np.ndarray,
    n_bins: int = 10,
) -> str:
    raw_ece = compute_ece(confidences, successes, n_bins)
    cal_ece = compute_ece(calibrated_confidences, successes, n_bins)
    raw_mce = compute_mce(confidences, successes, n_bins)
    cal_mce = compute_mce(calibrated_confidences, successes, n_bins)
    raw_brier = compute_brier_score(confidences, successes)
    cal_brier = compute_brier_score(calibrated_confidences, successes)

    raw_rd = compute_reliability_diagram(confidences, successes, n_bins)
    cal_rd = compute_reliability_diagram(calibrated_confidences, successes, n_bins)

    lines = [
        "=" * 72,
        "CALIBRATION REPORT",
        "=" * 72,
        "",
        "Summary Metrics",
        "-" * 40,
        f"  {'Metric':<30} {'Before':>10} {'After':>10} {'Delta':>10}",
        f"  {'-' * 30} {'-' * 10} {'-' * 10} {'-' * 10}",
        f"  {'ECE':<30} {raw_ece:>10.4f} {cal_ece:>10.4f} {raw_ece - cal_ece:>+10.4f}",
        f"  {'MCE':<30} {raw_mce:>10.4f} {cal_mce:>10.4f} {raw_mce - cal_mce:>+10.4f}",
        f"  {'Brier Score':<30} {raw_brier:>10.4f} {cal_brier:>10.4f} {raw_brier - cal_brier:>+10.4f}",
        "",
        f"  Total samples: {len(confidences)}",
        f"  Base accuracy: {float(successes.mean()):.4f}",
        "",
        "Reliability Diagram (Before Calibration)",
        "-" * 40,
        f"  {'Bin':>5} {'Range':>12} {'Count':>7} {'Acc':>8} {'Conf':>8} {'Gap':>8}",
        f"  {'-' * 5} {'-' * 12} {'-' * 7} {'-' * 8} {'-' * 8} {'-' * 8}",
    ]

    for i, b in enumerate(raw_rd["bins"]):
        r = f"{b['bin_lower']:.2f}-{b['bin_upper']:.2f}"
        lines.append(
            f"  {i:>5} {r:>12} {b['count']:>7} "
            f"{b['accuracy']:>8.4f} {b['avg_confidence']:>8.4f} {b['gap']:>+8.4f}"
        )

    lines.extend(
        [
            "",
            "Reliability Diagram (After Calibration)",
            "-" * 40,
            f"  {'Bin':>5} {'Range':>12} {'Count':>7} {'Acc':>8} {'Conf':>8} {'Gap':>8}",
            f"  {'-' * 5} {'-' * 12} {'-' * 7} {'-' * 8} {'-' * 8} {'-' * 8}",
        ]
    )

    for i, b in enumerate(cal_rd["bins"]):
        r = f"{b['bin_lower']:.2f}-{b['bin_upper']:.2f}"
        lines.append(
            f"  {i:>5} {r:>12} {b['count']:>7} "
            f"{b['accuracy']:>8.4f} {b['avg_confidence']:>8.4f} {b['gap']:>+8.4f}"
        )

    lines.append("")
    lines.append("=" * 72)

    return "\n".join(lines)
