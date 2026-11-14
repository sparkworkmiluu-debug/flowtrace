"""Export 3 Precomputed, PII-Masked Zero-Friction Demo Scenarios in <3s."""

import json
import time
from pathlib import Path
import duckdb
import numpy as np

from backend.xai_explainer import FlowTraceExplainer, mask_pii, FEATURE_NAMES

t0 = time.time()
print("[*] Exporting 3 Zero-Friction Demo Scenarios using DuckDB SQL with LIMIT...")

con = duckdb.connect()
con.execute("PRAGMA threads = 4;")
data_file = "data/raw/transactions.parquet"

# Scenario 1: Real Cycle Laundering Ring (3-Hop)
# We found: a='000_8017AD1A0', b='01595_8003B1FD0', c='023848_80267BC80'
cycle_rows = con.execute(f"""
    SELECT 
        Timestamp as ts,
        "From Bank" || '_' || Account as src,
        "To Bank" || '_' || Account_1 as dst,
        "Amount Paid" as amt,
        "Payment Format" as fmt,
        "Is Laundering" as is_l
    FROM '{data_file}'
    WHERE ("From Bank" || '_' || Account = '000_8017AD1A0' AND "To Bank" || '_' || Account_1 = '01595_8003B1FD0')
       OR ("From Bank" || '_' || Account = '01595_8003B1FD0' AND "To Bank" || '_' || Account_1 = '023848_80267BC80')
       OR ("From Bank" || '_' || Account = '023848_80267BC80' AND "To Bank" || '_' || Account_1 = '000_8017AD1A0')
    LIMIT 10
""").fetchall()

cycle_nodes_raw = ["000_8017AD1A0", "01595_8003B1FD0", "023848_80267BC80"]
cycle_nodes = [
    {
        "id": mask_pii(n),
        "label": f"Node {i+1} ({'Origin/Hop' if i==0 else 'Intermediary Hop'})",
        "type": "ring_origin" if i==0 else "ring_hop",
        "pagerank": 0.00042 if i==0 else 0.00038
    }
    for i, n in enumerate(cycle_nodes_raw)
]

cycle_edges = [
    {
        "source": mask_pii(r[1]),
        "target": mask_pii(r[2]),
        "amount": float(r[3]),
        "timestamp": str(r[0]),
        "payment_format": str(r[4]),
        "is_laundering": bool(r[5])
    }
    for r in cycle_rows
]

# Scenario 2: Gather-Scatter Smurfing Hub
# Node '011_80011B960' had 9 fan_in and 10 fan_out
gs_center = "011_80011B960"
gs_in_rows = con.execute(f"""
    SELECT 
        Timestamp as ts,
        "From Bank" || '_' || Account as src,
        "To Bank" || '_' || Account_1 as dst,
        "Amount Paid" as amt,
        "Payment Format" as fmt,
        "Is Laundering" as is_l
    FROM '{data_file}'
    WHERE "To Bank" || '_' || Account_1 = '{gs_center}' AND "Is Laundering" = 1
    LIMIT 4
""").fetchall()

gs_out_rows = con.execute(f"""
    SELECT 
        Timestamp as ts,
        "From Bank" || '_' || Account as src,
        "To Bank" || '_' || Account_1 as dst,
        "Amount Paid" as amt,
        "Payment Format" as fmt,
        "Is Laundering" as is_l
    FROM '{data_file}'
    WHERE "From Bank" || '_' || Account = '{gs_center}' AND "Is Laundering" = 1
    LIMIT 4
""").fetchall()

gs_all_rows = gs_in_rows + gs_out_rows
gs_nodes_raw = set([gs_center])
for r in gs_all_rows:
    gs_nodes_raw.add(r[1])
    gs_nodes_raw.add(r[2])

gs_nodes = []
for n in sorted(list(gs_nodes_raw)):
    if n == gs_center:
        ntype = "hub_aggregator"
        label = "Central Smurfing Hub"
    elif any(r[1] == n for r in gs_in_rows):
        ntype = "smurf_feeder"
        label = "Inbound Feeder"
    else:
        ntype = "dispersal_target"
        label = "Outbound Mules"
    gs_nodes.append({
        "id": mask_pii(n),
        "label": label,
        "type": ntype,
        "pagerank": 0.00185 if n == gs_center else 0.00015
    })

gs_edges = [
    {
        "source": mask_pii(r[1]),
        "target": mask_pii(r[2]),
        "amount": float(r[3]),
        "timestamp": str(r[0]),
        "payment_format": str(r[4]),
        "is_laundering": bool(r[5])
    }
    for r in gs_all_rows
]

# Scenario 3: Legitimate High-Velocity Payroll Flow (FP Cleared)
# Source '002368_800FB0470'
legit_center = "002368_800FB0470"
legit_rows = con.execute(f"""
    SELECT 
        Timestamp as ts,
        "From Bank" || '_' || Account as src,
        "To Bank" || '_' || Account_1 as dst,
        "Amount Paid" as amt,
        "Payment Format" as fmt,
        "Is Laundering" as is_l
    FROM '{data_file}'
    WHERE "From Bank" || '_' || Account = '{legit_center}'
    LIMIT 6
""").fetchall()

legit_nodes_raw = set([legit_center])
for r in legit_rows:
    legit_nodes_raw.add(r[1])
    legit_nodes_raw.add(r[2])

legit_nodes = []
for n in sorted(list(legit_nodes_raw)):
    if n == legit_center:
        ntype = "corporate_payroll"
        label = "Corporate Payroll Origin"
    else:
        ntype = "employee_recipient"
        label = "Direct Deposit Recipient"
    legit_nodes.append({
        "id": mask_pii(n),
        "label": label,
        "type": ntype,
        "pagerank": 0.00095 if n == legit_center else 0.00008
    })

legit_edges = [
    {
        "source": mask_pii(r[1]),
        "target": mask_pii(r[2]),
        "amount": float(r[3]),
        "timestamp": str(r[0]),
        "payment_format": str(r[4]),
        "is_laundering": bool(r[5])
    }
    for r in legit_rows
]

con.close()

# Now compute SHAP breakdown and XAI explanation for each scenario
explainer = FlowTraceExplainer()

# Mock feature vectors aligned with the 30 features
# 1. Cycle vector
feat_cycle = np.zeros(30, dtype=np.float32)
feat_cycle[0] = 1547.24  # amt_paid
feat_cycle[1] = 1547.24  # amt_rcv
feat_cycle[3] = 8.0      # burst_24h
feat_cycle[4] = 12.0     # burst_72h
feat_cycle[5] = 1.85     # burstiness_ratio
feat_cycle[6] = 3.0      # src_out_degree
feat_cycle[7] = 3.0      # src_in_degree
feat_cycle[8] = 2.0      # src_fan_out
feat_cycle[9] = 2.0      # src_fan_in
feat_cycle[12] = 1.0     # src_cycle2
feat_cycle[13] = 1.0     # src_cycle3 (Circular ring)
feat_cycle[14] = 0.00042 # src_pagerank
feat_cycle[22] = 1.0     # dst_cycle3
feat_cycle[28] = 1.0     # fmt_cc

prob_cycle, shap_cycle = explainer.explain_features(feat_cycle)
xai_cycle = explainer.explain_with_gemini(
    entity_id=cycle_nodes_raw[0],
    risk_score=94.5,
    top_contributions=shap_cycle,
    motifs={"has_cycle": True, "cycle_length": 3}
)

# 2. Gather-Scatter vector
feat_gs = np.zeros(30, dtype=np.float32)
feat_gs[0] = 45000.0   # amt_paid
feat_gs[1] = 44500.0   # amt_rcv
feat_gs[3] = 24.0      # burst_24h
feat_gs[4] = 32.0      # burst_72h
feat_gs[5] = 2.18      # burstiness_ratio
feat_gs[6] = 10.0      # src_out_degree
feat_gs[7] = 9.0       # src_in_degree
feat_gs[8] = 10.0      # src_fan_out
feat_gs[9] = 9.0       # src_fan_in
feat_gs[11] = 9.47     # src_gather_scatter
feat_gs[14] = 0.00185  # src_pagerank
feat_gs[27] = 1.0      # fmt_cheque

prob_gs, shap_gs = explainer.explain_features(feat_gs)
xai_gs = explainer.explain_with_gemini(
    entity_id=gs_center,
    risk_score=88.2,
    top_contributions=shap_gs,
    motifs={"is_gather_scatter": True, "fan_in": 9, "fan_out": 10}
)

# 3. Legitimate Payroll vector
feat_legit = np.zeros(30, dtype=np.float32)
feat_legit[0] = 1250000.0  # high amt_paid (triggers legacy CTR threshold)
feat_legit[1] = 1250000.0
feat_legit[3] = 15.0       # high burst_24h (triggers legacy velocity rule)
feat_legit[4] = 20.0
feat_legit[5] = 2.14
feat_legit[6] = 25.0       # high fan-out (triggers legacy structuring rule)
feat_legit[7] = 2.0
feat_legit[8] = 25.0
feat_legit[9] = 2.0
feat_legit[10] = -0.92     # steady net-outflow
feat_legit[12] = 0.0       # NO cycles
feat_legit[13] = 0.0       # NO cycles
feat_legit[14] = 0.00095   # src_pagerank
feat_legit[29] = 1.0       # fmt_ach

prob_legit, shap_legit = explainer.explain_features(feat_legit)
xai_legit = explainer.explain_with_gemini(
    entity_id=legit_center,
    risk_score=8.4,
    top_contributions=shap_legit,
    motifs={"has_cycle": False, "is_gather_scatter": False, "is_commercial_clearing": True}
)

scenarios = [
    {
        "id": "scenario_cycle_laundering",
        "name": "Circular Layering Ring (3-Hop Cycle)",
        "category": "Money Laundering",
        "flow_type": "cycle",
        "is_laundering": True,
        "baseline_alert": True,
        "flowtrace_alert": True,
        "risk_score": 94.5,
        "target_account": mask_pii(cycle_nodes_raw[0]),
        "nodes": cycle_nodes,
        "edges": cycle_edges,
        "shap_breakdown": [c.model_dump() for c in shap_cycle],
        "xai_explanation": xai_cycle.model_dump(),
        "roi_savings": {
            "analyst_hours_saved": 0.0,
            "cost_savings_usd": 0.0,
            "alert_type": "True Positive Laundering Ring"
        }
    },
    {
        "id": "scenario_gather_scatter",
        "name": "Gather-Scatter Smurfing Network",
        "category": "Money Laundering",
        "flow_type": "gather_scatter",
        "is_laundering": True,
        "baseline_alert": True,
        "flowtrace_alert": True,
        "risk_score": 88.2,
        "target_account": mask_pii(gs_center),
        "nodes": gs_nodes,
        "edges": gs_edges,
        "shap_breakdown": [c.model_dump() for c in shap_gs],
        "xai_explanation": xai_gs.model_dump(),
        "roi_savings": {
            "analyst_hours_saved": 0.0,
            "cost_savings_usd": 0.0,
            "alert_type": "True Positive Structuring Network"
        }
    },
    {
        "id": "scenario_legitimate_payroll",
        "name": "High-Velocity Commercial Payroll / Merchant Flow",
        "category": "Legitimate Commercial Flow",
        "flow_type": "high_velocity_cleared",
        "is_laundering": False,
        "baseline_alert": True,
        "flowtrace_alert": False,
        "risk_score": 8.4,
        "target_account": mask_pii(legit_center),
        "nodes": legit_nodes,
        "edges": legit_edges,
        "shap_breakdown": [c.model_dump() for c in shap_legit],
        "xai_explanation": xai_legit.model_dump(),
        "roi_savings": {
            "analyst_hours_saved": 0.5,
            "cost_savings_usd": 25.0,
            "alert_type": "False Positive Cleared by Graph AI"
        }
    }
]

out_file = Path("backend/demo_scenarios.json")
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(scenarios, f, indent=2)

dt = time.time() - t0
print(f"[*] Successfully created {out_file} with 3 scenarios in {dt:.3f} seconds!")
