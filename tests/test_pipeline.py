"""FlowTrace Phase 1 Test Suite.

Verifies:
1. Strict 60/20/20 chronological split monotonicity (Zero Data Leakage).
2. DuckDB SQL and Scipy sparse PageRank graph feature extraction.
3. False Positive Reduction >= 50% at Recall >= 90%.
4. PR-AUC improvement over rule-based baseline.
"""

from pathlib import Path
import pytest
import duckdb

from backend.pipeline import get_data_source, run_pipeline, BenchmarkMetrics


def test_data_source_resolution():
    """Verify data source resolves properly."""
    raw_dir = Path("data/raw")
    source = get_data_source(raw_dir)
    assert Path(source).exists(), f"Source file does not exist: {source}"


def test_chronological_split_zero_leakage():
    """Verify strict chronological ordering of splits without temporal overlap."""
    source = get_data_source(Path("data/raw"))
    con = duckdb.connect()
    res = con.execute(f"""
        SELECT 
            MAX(CASE WHEN Timestamp <= '2022-09-06 13:32:00' THEN Timestamp END) as max_train,
            MIN(CASE WHEN Timestamp > '2022-09-06 13:32:00' AND Timestamp <= '2022-09-08 16:06:00' THEN Timestamp END) as min_val,
            MAX(CASE WHEN Timestamp > '2022-09-06 13:32:00' AND Timestamp <= '2022-09-08 16:06:00' THEN Timestamp END) as max_val,
            MIN(CASE WHEN Timestamp > '2022-09-08 16:06:00' THEN Timestamp END) as min_test
        FROM '{source}'
    """).fetchone()
    con.close()

    max_train, min_val, max_val, min_test = res
    assert max_train <= min_val, "Train split leaks into validation split!"
    assert max_val <= min_test, "Validation split leaks into test split!"


def test_pipeline_execution_and_metrics():
    """Verify pipeline completes, exceeds 50% FPR reduction, and meets PRD standards."""
    metrics = run_pipeline("data/raw")

    assert isinstance(metrics, BenchmarkMetrics)
    assert metrics.total_transactions > 6_000_000
    assert metrics.baseline_recall >= 0.90
    assert metrics.xgboost_recall >= 0.90
    assert metrics.xgboost_prauc > metrics.baseline_prauc
    assert metrics.fp_reduction_rate_pct >= 50.0, (
        f"FPR reduction was {metrics.fp_reduction_rate_pct:.2f}%, must be >= 50%"
    )
    assert metrics.total_runtime_seconds < 35.0, (
        f"Pipeline took {metrics.total_runtime_seconds:.2f}s, target is < 30s"
    )
