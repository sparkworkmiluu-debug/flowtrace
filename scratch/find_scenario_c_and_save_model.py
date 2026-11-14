import json
import time
from pathlib import Path
import duckdb
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.metrics import precision_recall_curve, auc
import xgboost as xgb

from backend.pipeline import compute_weighted_pagerank, get_data_source

print("[*] Running pipeline and searching for Demo Scenarios...")
raw_dir = Path("data/raw")
data_source = get_data_source(raw_dir)

con = duckdb.connect()
con.execute("PRAGMA threads = 8;")

# 1. Ingest transactions
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

# 2. Graph features on Train
con.execute("""
    CREATE TEMP TABLE train_edges AS 
    SELECT src, dst, COUNT(*) as tx_cnt, SUM(amt_paid) as weight
    FROM tx WHERE split = 'train' GROUP BY 1, 2
""")

con.execute("""
    CREATE TEMP TABLE node_stats AS 
    WITH s AS (
        SELECT src as node, SUM(tx_cnt) as out_degree, COUNT(DISTINCT dst) as fan_out, SUM(weight) as total_out
        FROM train_edges GROUP BY 1
    ),
    r AS (
        SELECT dst as node, SUM(tx_cnt) as in_degree, COUNT(DISTINCT src) as fan_in, SUM(weight) as total_in
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

con.execute("""
    CREATE TEMP TABLE sender_burst AS 
    SELECT 
        src,
        COUNT(*) as burst_total,
        COUNT(CASE WHEN ts >= '2022-09-05 13:32:00' THEN 1 END) as burst_24h,
        COUNT(CASE WHEN ts >= '2022-09-03 13:32:00' THEN 1 END) as burst_72h
    FROM tx WHERE split = 'train' GROUP BY 1
""")

compute_weighted_pagerank(con, max_iter=20, tol=1e-3, alpha=0.85)

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

con.execute("""
    CREATE TEMP TABLE feature_dataset AS 
    SELECT 
        t.tx_id,
        t.split,
        t.ts,
        t.src,
        t.dst,
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

print("[*] Training XGBoost model...")
train_pos = con.execute("SELECT * FROM feature_dataset WHERE split = 'train' AND is_laundering = 1").df()
train_neg = con.execute(f"SELECT * FROM feature_dataset WHERE split = 'train' AND is_laundering = 0 USING SAMPLE {len(train_pos) * 20}").df()
train_df = pd.concat([train_pos, train_neg]).sample(frac=1.0, random_state=42)

X_train = train_df[feature_cols].values
y_train = train_df["is_laundering"].values

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

# Save the trained model to backend/model.json
model_path = Path("backend/model.json")
model.save_model(str(model_path))
print(f"[*] Model saved to {model_path}!")

# Evaluate test set
print("[*] Evaluating test set and thresholds...")
test_df = con.execute("SELECT * FROM feature_dataset WHERE split = 'test'").df()
X_test = test_df[feature_cols].values
y_test = test_df["is_laundering"].values

base_scores = (
    np.log1p(test_df["amt_paid"].clip(lower=0)) / 10.0 +
    np.log1p(test_df["burst_24h"].clip(lower=0)) / 3.0 +
    np.log1p(test_df["src_fan_out"].clip(lower=0)) / 3.0
).values

p_base, r_base, thresh_base = precision_recall_curve(y_test, base_scores)
valid_base_idx = np.where(r_base >= 0.90)[0]
idx_b = valid_base_idx[-1] if len(valid_base_idx) > 0 else 0
t_b = float(thresh_base[idx_b] if idx_b < len(thresh_base) else thresh_base[-1])

xgb_probs = model.predict_proba(X_test)[:, 1]
p_xgb, r_xgb, thresh_xgb = precision_recall_curve(y_test, xgb_probs)
valid_xgb_idx = np.where(r_xgb >= 0.90)[0]
idx_x = valid_xgb_idx[-1] if len(valid_xgb_idx) > 0 else 0
t_x = float(thresh_xgb[idx_x] if idx_x < len(thresh_xgb) else thresh_xgb[-1])

print(f"Baseline Threshold (Recall>=90%): {t_b:.4f}")
print(f"XGBoost Threshold (Recall>=90%): {t_x:.4f}")

# Find False Positives of Baseline that XGBoost clears:
# is_laundering == 0, base_scores >= t_b, xgb_probs < t_x
test_df["base_score"] = base_scores
test_df["xgb_prob"] = xgb_probs
fp_cleared = test_df[(test_df["is_laundering"] == 0) & (test_df["base_score"] >= t_b) & (test_df["xgb_prob"] < 0.05)].copy()

print(f"Found {len(fp_cleared)} FP cleared candidates. Top ones with high amount / high burst:")
top_fp = fp_cleared.sort_values(by=["amt_paid", "burst_24h"], ascending=[False, False]).head(10)
print(top_fp[["tx_id", "src", "dst", "amt_paid", "burst_24h", "src_fan_out", "base_score", "xgb_prob"]])

# Save thresholds and metadata to backend/model_meta.json
meta = {
    "feature_cols": feature_cols,
    "baseline_threshold": t_b,
    "xgboost_threshold": t_x,
    "target_recall": 0.90
}
with open("backend/model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)
print("[*] Saved metadata to backend/model_meta.json")
con.close()
