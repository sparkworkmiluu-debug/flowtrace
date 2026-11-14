"""FlowTrace Phase 1 - High-Speed Anti-Money Laundering (AML) Graph Benchmark Pipeline.

Strict Project Contract Implementation (FLOWTRACE_STANDARDS_AND_PRD.md):
1. Ingest via DuckDB (multi-threaded C++ engine).
2. Strict 60/20/20 Chronological Split (Zero Data Leakage).
3. 3-Rule AML Baseline (CTR Amount, Velocity Burst, Fan-Out Structuring).
4. Graph-Augmented XGBoost (In/Out Degree, Net-Flow Ratio, Temporal Burstiness,
   2-cycle/3-hop cycle indicators, and Scipy sparse Weighted PageRank).
5. Evaluation on Test Set: PR-AUC, False Positive Reduction (%) at Recall >= 90%,
   and Analyst Hours Saved per 1M transactions (NO ACCURACY).
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, Tuple

import duckdb
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.metrics import precision_recall_curve, auc
import xgboost as xgb


@dataclass(frozen=True)
class BenchmarkMetrics:
    """Dataclass holding rigorous Quant AML benchmark metrics."""
    total_transactions: int
    train_size: int
    val_size: int
    test_size: int
    actual_positives_test: int
    baseline_prauc: float
    xgboost_prauc: float
    baseline_recall: float
    xgboost_recall: float
    baseline_fp: int
    xgboost_fp: int
    fp_reduction_rate_pct: float
    fp_saved_per_1m: float
    analyst_hours_saved_per_1m: float
    cost_savings_per_1m_usd: float
    total_runtime_seconds: float


def get_data_source(raw_dir: Path) -> str:
    """Return fast Parquet path if exists, otherwise convert/read raw CSV.
    
    DuckDB handles Parquet reading with zero serialization overhead and column pruning.
    """
    parquet_path = raw_dir / "transactions.parquet"
    csv_path = raw_dir / "LI-Small_Trans.csv"

    if parquet_path.exists():
        return str(parquet_path).replace("\\", "/")

    if not csv_path.exists():
        raise FileNotFoundError(f"Missing dataset at {csv_path}")

    # Convert CSV to Parquet on first run for 50x query speedup
    print(f"[*] Parquet cache not found. Ingesting {csv_path.name} via DuckDB to Parquet...")
    con = duckdb.connect()
    con.execute(f"""
        COPY (SELECT * FROM read_csv('{str(csv_path).replace('\\', '/')}', header=true, auto_detect=true))
        TO '{str(parquet_path).replace('\\', '/')}' (FORMAT PARQUET)
    """)
    con.close()
    return str(parquet_path).replace("\\", "/")


def compute_weighted_pagerank(
    con: duckdb.DuckDBPyConnection,
    max_iter: int = 20,
    tol: float = 1e-3,
    alpha: float = 0.85
) -> None:
    """Compute weighted PageRank via Scipy sparse CSR matrix on collapsed edges.
    
    Assigns dense integer IDs directly in DuckDB SQL to eliminate Python dict overhead,
    builds column-stochastic CSR transition matrix, and executes power iteration in C/C++.
    """
    con.execute("""
        CREATE TEMP TABLE train_nodes AS 
        SELECT node, ROW_NUMBER() OVER () - 1 as node_idx
        FROM (
            SELECT src as node FROM train_edges
            UNION
            SELECT dst as node FROM train_edges
        )
    """)
    n_nodes = con.execute("SELECT COUNT(*) FROM train_nodes").fetchone()[0]

    # Fetch edge indices and weights directly as numpy arrays
    edges_arr = con.execute("""
        SELECT 
            tn_src.node_idx as src_idx, 
            tn_dst.node_idx as dst_idx, 
            e.weight 
        FROM train_edges e
        JOIN train_nodes tn_src ON e.src = tn_src.node
        JOIN train_nodes tn_dst ON e.dst = tn_dst.node
    """).fetchnumpy()

    src_idx = edges_arr["src_idx"]
    dst_idx = edges_arr["dst_idx"]
    weights = edges_arr["weight"].astype(np.float64)

    # Normalize out-weights for column-stochastic matrix
    out_weight = np.bincount(src_idx, weights=weights, minlength=n_nodes)
    valid_mask = out_weight[src_idx] > 0
    norm_w = np.zeros_like(weights)
    norm_w[valid_mask] = weights[valid_mask] / out_weight[src_idx[valid_mask]]

    # Sparse transition matrix: shape (n_nodes, n_nodes), row=dst, col=src
    M = sp.csr_matrix((norm_w, (dst_idx, src_idx)), shape=(n_nodes, n_nodes))

    # Power Iteration with dangling node teleportation
    p = np.full(n_nodes, 1.0 / n_nodes, dtype=np.float64)
    dangling = (out_weight == 0)

    for _ in range(max_iter):
        p_prev = p.copy()
        dangling_sum = np.sum(p[dangling])
        p = alpha * (M.dot(p) + dangling_sum / n_nodes) + (1.0 - alpha) / n_nodes
        if np.sum(np.abs(p - p_prev)) < tol:
            break

    # Register PageRank back into DuckDB session
    con.register("pr_arr", {"node_idx": np.arange(n_nodes, dtype=np.int64), "pagerank": p})
    con.execute("""
        CREATE TEMP TABLE node_pr AS 
        SELECT tn.node, pr.pagerank 
        FROM train_nodes tn 
        JOIN pr_arr pr ON tn.node_idx = pr.node_idx
    """)


def run_pipeline(data_dir: Path | str = "data/raw") -> BenchmarkMetrics:
    """Execute end-to-end FlowTrace AML benchmark pipeline under 30 seconds."""
    t_start = time.time()
    raw_dir = Path(data_dir)
    data_source = get_data_source(raw_dir)

    print("=" * 68)
    print("FLOWTRACE QUANT AML BENCHMARK PIPELINE - PHASE 1")
    print("Zero Data Leakage | DuckDB C++ Engine | Scipy PR | Graph XGBoost")
    print("=" * 68)

    # Initialize multi-threaded DuckDB connection
    con = duckdb.connect()
    con.execute("PRAGMA threads = 8;")

    # 1. Ingest transactions & enforce 60/20/20 chronological split
    print("\n[Step 1/5] Ingesting transactions and enforcing strict 60/20/20 split...")
    con.execute(f"""
        CREATE TEMP TABLE tx AS 
        SELECT 
            ROW_NUMBER() OVER () as tx_id,
            Timestamp as ts,
            "From Bank" || '_' || Account as src,
            "To Bank" || '_' || Account_1 as dst,
            "Amount Received" as amt_rcv,
            "Amount Paid" as amt_paid,
            "Payment Format" as payment_format,
            "Is Laundering" as is_laundering,
            CASE 
                WHEN Timestamp <= '2022-09-06 13:32:00' THEN 'train'
                WHEN Timestamp <= '2022-09-08 16:06:00' THEN 'val'
                ELSE 'test'
            END as split
        FROM '{data_source}'
    """)

    split_counts = dict(con.execute("SELECT split, COUNT(*) FROM tx GROUP BY 1").fetchall())
    n_train = split_counts.get("train", 0)
    n_val = split_counts.get("val", 0)
    n_test = split_counts.get("test", 0)
    total_tx = n_train + n_val + n_test
    print(f"  -> Total transactions: {total_tx:,} (Train: {n_train:,}, Val: {n_val:,}, Test: {n_test:,})")

    # 2. Collapse parallel edges on Train graph (Zero Data Leakage)
    print("[Step 2/5] Collapsing parallel edges & computing graph features in DuckDB SQL...")
    con.execute("""
        CREATE TEMP TABLE train_edges AS 
        SELECT 
            src, 
            dst, 
            COUNT(*) as tx_cnt, 
            SUM(amt_paid) as weight
        FROM tx 
        WHERE split = 'train' 
        GROUP BY 1, 2
    """)

    # Compute Degrees, Fan In/Out, Net Flow Ratio, and Gather-Scatter in DuckDB
    con.execute("""
        CREATE TEMP TABLE node_stats AS 
        WITH s AS (
            SELECT 
                src as node, 
                SUM(tx_cnt) as out_degree, 
                COUNT(DISTINCT dst) as fan_out, 
                SUM(weight) as total_out
            FROM train_edges GROUP BY 1
        ),
        r AS (
            SELECT 
                dst as node, 
                SUM(tx_cnt) as in_degree, 
                COUNT(DISTINCT src) as fan_in, 
                SUM(weight) as total_in
            FROM train_edges GROUP BY 1
        )
        SELECT 
            COALESCE(s.node, r.node) as node,
            COALESCE(s.out_degree, 0) as out_degree,
            COALESCE(r.in_degree, 0) as in_degree,
            COALESCE(s.fan_out, 0) as fan_out,
            COALESCE(r.fan_in, 0) as fan_in,
            COALESCE(s.total_out, 0.0) as total_out,
            COALESCE(r.total_in, 0.0) as total_in,
            (COALESCE(r.total_in, 0.0) - COALESCE(s.total_out, 0.0)) / 
                (COALESCE(r.total_in, 0.0) + COALESCE(s.total_out, 0.0) + 1.0) as net_flow_ratio,
            (2.0 * COALESCE(s.fan_out, 0) * COALESCE(r.fan_in, 0)) / 
                (COALESCE(s.fan_out, 0) + COALESCE(r.fan_in, 0) + 1.0) as gather_scatter
        FROM s FULL OUTER JOIN r ON s.node = r.node
    """)

    # Compute 2-cycle (reciprocal) and 3-hop cycle indicators in DuckDB C++
    con.execute("""
        CREATE TEMP TABLE cycle_motifs AS 
        WITH recip AS (
            SELECT e1.src as node, 1 as has_cycle2
            FROM train_edges e1
            JOIN train_edges e2 ON e1.dst = e2.src AND e1.src = e2.dst
            GROUP BY 1
        ),
        c3 AS (
            SELECT e1.src as node, 1 as has_cycle3
            FROM train_edges e1
            JOIN train_edges e2 ON e1.dst = e2.src AND e1.src != e2.dst
            JOIN train_edges e3 ON e2.dst = e3.src AND e3.dst = e1.src AND e3.src != e1.dst
            GROUP BY 1
        )
        SELECT 
            ns.node,
            COALESCE(recip.has_cycle2, 0) as has_cycle2,
            COALESCE(c3.has_cycle3, 0) as has_cycle3
        FROM (SELECT DISTINCT node FROM node_stats) ns
        LEFT JOIN recip ON ns.node = recip.node
        LEFT JOIN c3 ON ns.node = c3.node
    """)

    # Compute Temporal Burstiness (24h and 72h window velocity) in DuckDB
    con.execute("""
        CREATE TEMP TABLE sender_burst AS 
        SELECT 
            src,
            COUNT(*) as burst_total,
            COUNT(CASE WHEN ts >= '2022-09-05 13:32:00' THEN 1 END) as burst_24h,
            COUNT(CASE WHEN ts >= '2022-09-03 13:32:00' THEN 1 END) as burst_72h
        FROM tx 
        WHERE split = 'train' 
        GROUP BY 1
    """)

    # 3. Compact DiGraph PageRank with Scipy Sparse
    print("[Step 3/5] Computing Weighted PageRank (max_iter=20, tol=1e-3 via Scipy Sparse)...")
    compute_weighted_pagerank(con, max_iter=20, tol=1e-3, alpha=0.85)

    # Master node features lookup table
    con.execute("""
        CREATE TEMP TABLE master_nodes AS 
        SELECT 
            ns.*,
            cm.has_cycle2,
            cm.has_cycle3,
            COALESCE(pr.pagerank, 1e-7) as pagerank
        FROM node_stats ns
        JOIN cycle_motifs cm ON ns.node = cm.node
        LEFT JOIN node_pr pr ON ns.node = pr.node
    """)

    # 4. Materialize transaction features for modeling
    print("[Step 4/5] Materializing transaction features & building train/test matrices...")
    con.execute("""
        CREATE TEMP TABLE feature_dataset AS 
        SELECT 
            t.tx_id,
            t.split,
            t.is_laundering,
            t.amt_paid,
            t.amt_rcv,
            (t.amt_paid - t.amt_rcv) as amt_diff,
            COALESCE(b.burst_24h, 0) as burst_24h,
            COALESCE(b.burst_72h, 0) as burst_72h,
            (COALESCE(b.burst_24h, 0) * 3.0) / (COALESCE(b.burst_72h, 0) + 1.0) as burstiness_ratio,
            
            -- Sender features
            COALESCE(sn.out_degree, 0) as src_out_degree,
            COALESCE(sn.in_degree, 0) as src_in_degree,
            COALESCE(sn.fan_out, 0) as src_fan_out,
            COALESCE(sn.fan_in, 0) as src_fan_in,
            COALESCE(sn.net_flow_ratio, 0.0) as src_net_flow_ratio,
            COALESCE(sn.gather_scatter, 0.0) as src_gather_scatter,
            COALESCE(sn.has_cycle2, 0) as src_cycle2,
            COALESCE(sn.has_cycle3, 0) as src_cycle3,
            COALESCE(sn.pagerank, 1e-7) as src_pagerank,
            
            -- Receiver features
            COALESCE(rn.out_degree, 0) as dst_out_degree,
            COALESCE(rn.in_degree, 0) as dst_in_degree,
            COALESCE(rn.fan_out, 0) as dst_fan_out,
            COALESCE(rn.fan_in, 0) as dst_fan_in,
            COALESCE(rn.net_flow_ratio, 0.0) as dst_net_flow_ratio,
            COALESCE(rn.gather_scatter, 0.0) as dst_gather_scatter,
            COALESCE(rn.has_cycle2, 0) as dst_cycle2,
            COALESCE(rn.has_cycle3, 0) as dst_cycle3,
            COALESCE(rn.pagerank, 1e-7) as dst_pagerank,
            
            -- Graph interaction
            COALESCE(rn.pagerank, 1e-7) / (COALESCE(sn.pagerank, 1e-7) + 1e-9) as pagerank_ratio,
            
            -- One-hot payment formats
            CASE WHEN t.payment_format = 'Cash' THEN 1 ELSE 0 END as fmt_cash,
            CASE WHEN t.payment_format = 'Cheque' THEN 1 ELSE 0 END as fmt_cheque,
            CASE WHEN t.payment_format = 'Credit Card' THEN 1 ELSE 0 END as fmt_cc,
            CASE WHEN t.payment_format = 'ACH' THEN 1 ELSE 0 END as fmt_ach,
            CASE WHEN t.payment_format = 'Bitcoin' THEN 1 ELSE 0 END as fmt_btc
        FROM tx t
        LEFT JOIN sender_burst b ON t.src = b.src
        LEFT JOIN master_nodes sn ON t.src = sn.node
        LEFT JOIN master_nodes rn ON t.dst = rn.node
    """)

    feature_cols = [
        "amt_paid", "amt_rcv", "amt_diff", "burst_24h", "burst_72h", "burstiness_ratio",
        "src_out_degree", "src_in_degree", "src_fan_out", "src_fan_in", "src_net_flow_ratio",
        "src_gather_scatter", "src_cycle2", "src_cycle3", "src_pagerank",
        "dst_out_degree", "dst_in_degree", "dst_fan_out", "dst_fan_in", "dst_net_flow_ratio",
        "dst_gather_scatter", "dst_cycle2", "dst_cycle3", "dst_pagerank",
        "pagerank_ratio", "fmt_cash", "fmt_cheque", "fmt_cc", "fmt_ach", "fmt_btc"
    ]

    # Sample balanced train set (all positive laundering + 20:1 negative ratio)
    train_pos = con.execute("SELECT * FROM feature_dataset WHERE split = 'train' AND is_laundering = 1").df()
    train_neg = con.execute(f"SELECT * FROM feature_dataset WHERE split = 'train' AND is_laundering = 0 USING SAMPLE {len(train_pos) * 20}").df()
    train_df = pd.concat([train_pos, train_neg]).sample(frac=1.0, random_state=42)

    test_df = con.execute("SELECT * FROM feature_dataset WHERE split = 'test'").df()

    X_train = train_df[feature_cols].values
    y_train = train_df["is_laundering"].values

    X_test = test_df[feature_cols].values
    y_test = test_df["is_laundering"].values
    actual_positives = int(np.sum(y_test == 1))

    # 5. Evaluate 3-Rule Baseline vs Graph-Augmented XGBoost
    print("[Step 5/5] Evaluating 3-Rule Baseline and training Graph-Augmented XGBoost...")

    # 3-Rule AML Baseline scoring function:
    # Rule 1: High Transaction Amount (CTR Large Value)
    # Rule 2: High Velocity (24h burstiness)
    # Rule 3: High Fan-Out (structuring / smurfing dispersal)
    base_scores = (
        np.log1p(test_df["amt_paid"].clip(lower=0)) / 10.0 +
        np.log1p(test_df["burst_24h"].clip(lower=0)) / 3.0 +
        np.log1p(test_df["src_fan_out"].clip(lower=0)) / 3.0
    ).values

    p_base, r_base, thresh_base = precision_recall_curve(y_test, base_scores)
    base_prauc = float(auc(r_base, p_base))

    # Baseline operating point at Recall >= 90%
    valid_base_idx = np.where(r_base >= 0.90)[0]
    idx_b = valid_base_idx[-1] if len(valid_base_idx) > 0 else 0
    t_b = thresh_base[idx_b] if idx_b < len(thresh_base) else thresh_base[-1]
    base_preds = (base_scores >= t_b).astype(int)

    fp_base = int(np.sum((base_preds == 1) & (y_test == 0)))
    base_recall = float(np.sum((base_preds == 1) & (y_test == 1)) / actual_positives)

    # Train XGBoost with tree_method="hist", n_jobs=-1
    model = xgb.XGBClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        tree_method="hist",
        n_jobs=-1,
        random_state=42,
        eval_metric="aucpr"
    )
    model.fit(X_train, y_train)

    # Predict test probabilities and evaluate PR-AUC
    xgb_probs = model.predict_proba(X_test)[:, 1]
    p_xgb, r_xgb, thresh_xgb = precision_recall_curve(y_test, xgb_probs)
    xgb_prauc = float(auc(r_xgb, p_xgb))

    # XGBoost operating point at Recall >= 90%
    valid_xgb_idx = np.where(r_xgb >= 0.90)[0]
    idx_x = valid_xgb_idx[-1] if len(valid_xgb_idx) > 0 else 0
    t_x = thresh_xgb[idx_x] if idx_x < len(thresh_xgb) else thresh_xgb[-1]
    xgb_preds = (xgb_probs >= t_x).astype(int)

    fp_xgb = int(np.sum((xgb_preds == 1) & (y_test == 0)))
    xgb_recall = float(np.sum((xgb_preds == 1) & (y_test == 1)) / actual_positives)

    # Compute Quant ROI metrics
    fp_reduction_pct = float(((fp_base - fp_xgb) / fp_base) * 100.0)
    fp_saved_per_1m = float(((fp_base - fp_xgb) / n_test) * 1_000_000)
    analyst_hours_saved = float(fp_saved_per_1m * 0.5)  # standard 30 min per alert review
    cost_savings = float(analyst_hours_saved * 50.0)    # $50/hour standard compliance rate
    total_runtime = float(time.time() - t_start)

    metrics = BenchmarkMetrics(
        total_transactions=total_tx,
        train_size=n_train,
        val_size=n_val,
        test_size=n_test,
        actual_positives_test=actual_positives,
        baseline_prauc=base_prauc,
        xgboost_prauc=xgb_prauc,
        baseline_recall=base_recall,
        xgboost_recall=xgb_recall,
        baseline_fp=fp_base,
        xgboost_fp=fp_xgb,
        fp_reduction_rate_pct=fp_reduction_pct,
        fp_saved_per_1m=fp_saved_per_1m,
        analyst_hours_saved_per_1m=analyst_hours_saved,
        cost_savings_per_1m_usd=cost_savings,
        total_runtime_seconds=total_runtime
    )

    con.close()

    # Print Official Report (Strict Quant Standards - NO ACCURACY)
    print("\n" + "=" * 68)
    print("  FLOWTRACE OFFICIAL BENCHMARK RESULTS (STRICT QUANT METRICS)")
    print("=" * 68)
    print(f"Dataset:                            LI-Small_Trans.csv ({metrics.total_transactions:,} rows)")
    print(f"Zero Data Leakage Split:            60% Train / 20% Val / 20% Test")
    print(f"Test Set Evaluation Window:         {metrics.test_size:,} transactions")
    print(f"Actual Positive Laundering Cases:   {metrics.actual_positives_test:,}")
    print("-" * 68)
    print(f"3-Rule AML Baseline PR-AUC:         {metrics.baseline_prauc:.6f}")
    print(f"FlowTrace Graph XGBoost PR-AUC:     {metrics.xgboost_prauc:.6f}  (Improvement: {metrics.xgboost_prauc / metrics.baseline_prauc:.1f}x)")
    print("-" * 68)
    print(f"Baseline False Positives (Recall={metrics.baseline_recall * 100:.1f}%):  {metrics.baseline_fp:,}")
    print(f"FlowTrace False Positives (Recall={metrics.xgboost_recall * 100:.1f}%): {metrics.xgboost_fp:,}")
    print(f"False Positive Reduction Rate:      {metrics.fp_reduction_rate_pct:.2f}%  (PRD Target >= 50%)")
    print("-" * 68)
    print(f"False Positive Alerts Saved / 1M:   {metrics.fp_saved_per_1m:,.1f} alerts")
    print(f"Compliance Analyst Hours Saved / 1M:{metrics.analyst_hours_saved_per_1m:,.1f} hours (@ 30 min/alert)")
    print(f"Estimated Cost Savings / 1M tx:     ${metrics.cost_savings_per_1m_usd:,.2f} (@ $50/hour)")
    print("-" * 68)
    print(f"Total Pipeline Runtime:             {metrics.total_runtime_seconds:.2f} seconds (< 30s target)")
    print("=" * 68)

    return metrics


if __name__ == "__main__":
    run_pipeline()
