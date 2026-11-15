"""FlowTrace Phase 2 Production API Server.

Strict Project Contract Implementation (FLOWTRACE_STANDARDS_AND_PRD.md):
1. GET /health: Operational status, engine metadata, threat intel stats.
2. GET /api/scenarios: 3 precomputed Zero-Friction Demo scenarios (<1s response).
3. POST /api/analyze: Real-time AML graph analysis with Pydantic validation,
   slowapi rate limiting (10 req/min/IP), threat intelligence blacklist verification,
   Tree-SHAP risk attribution, ROI cost savings calculation, and Gemini XAI narratives.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import numpy as np
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.threat_intel import check_threat_intel, is_blacklisted
from backend.xai_explainer import (
    FlowTraceExplainer,
    ShapContribution,
    XAINarrative,
    mask_pii,
    FEATURE_NAMES,
)

# Initialize Rate Limiter: 10 requests per minute per IP for analysis endpoint
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="FlowTrace AML Graph Intelligence API",
    description="High-Speed Quant Anti-Money Laundering & Graph XAI Platform",
    version="2.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration — explicitly allow local frontend origin (Phase 3)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Explainer Instance
EXPLAINER = FlowTraceExplainer()
DEMO_SCENARIOS_CACHE: Optional[List[Dict[str, Any]]] = None


def load_demo_scenarios() -> List[Dict[str, Any]]:
    """Load cached precomputed demo scenarios from JSON disk storage."""
    global DEMO_SCENARIOS_CACHE
    if DEMO_SCENARIOS_CACHE is None:
        p = Path("backend/demo_scenarios.json")
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                DEMO_SCENARIOS_CACHE = json.load(f)
        else:
            DEMO_SCENARIOS_CACHE = []
    return DEMO_SCENARIOS_CACHE


# --------------------------------------------------------------------------
# Pydantic Schemas
# --------------------------------------------------------------------------

class TransactionInput(BaseModel):
    """Individual transaction edge payload."""
    source: str = Field(..., min_length=3, max_length=128, description="Origin account or wallet address")
    target: str = Field(..., min_length=3, max_length=128, description="Destination account or wallet address")
    amount: float = Field(..., gt=0, description="Transfer amount in USD/currency units")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of the transfer")
    payment_format: Optional[str] = Field("Credit Card", description="Payment rail (Cash, ACH, Credit Card, Bitcoin, Cheque)")

    @field_validator("source", "target")
    @classmethod
    def validate_entities(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Entity address cannot be empty")
        return s


class AnalyzeRequest(BaseModel):
    """Payload for POST /api/analyze."""
    entity_id: str = Field(..., min_length=3, max_length=128, description="Wallet address or Bank Account to inspect")
    transactions: Optional[List[TransactionInput]] = Field(default_factory=list, description="Recent transaction subgraph")
    time_window_hours: Optional[int] = Field(24, ge=1, le=720, description="Analysis time window in hours")

    @field_validator("entity_id")
    @classmethod
    def validate_entity_id(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 3:
            raise ValueError("entity_id must be at least 3 characters")
        return s


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    pagerank: float


class GraphEdge(BaseModel):
    source: str
    target: str
    amount: float
    timestamp: str
    payment_format: str
    is_laundering: bool


class ROIMetrics(BaseModel):
    analyst_hours_saved: float
    cost_savings_usd: float
    alert_type: str
    compliance_verdict: str


class ThreatIntelHit(BaseModel):
    flagged: bool
    category: Optional[str] = None
    risk_level: Optional[str] = None
    source: Optional[str] = None
    description: Optional[str] = None


class AnalyzeResponse(BaseModel):
    """Complete Quant analysis response payload."""
    entity_id: str
    masked_entity: str
    risk_score: float  # 0.0 - 100.0
    risk_level: str    # LOW, MEDIUM, HIGH, CRITICAL
    baseline_alert: bool
    flowtrace_alert: bool
    threat_intel: ThreatIntelHit
    graph_nodes: List[GraphNode]
    graph_edges: List[GraphEdge]
    shap_breakdown: List[ShapContribution]
    xai_narrative: XAINarrative
    roi_savings: ROIMetrics
    execution_time_ms: float


# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@app.get("/health", summary="Health Check")
async def health_check():
    """Returns system status, active models, and operational timestamps."""
    return {
        "status": "healthy",
        "service": "FlowTrace AML Graph API",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_loaded": EXPLAINER.model is not None,
        "scenarios_ready": len(load_demo_scenarios()) == 3,
    }


@app.get("/api/scenarios", summary="Get Zero-Friction Demo Scenarios")
async def get_demo_scenarios():
    """Retrieve 3 precomputed, PII-masked AML demo scenarios in <10ms:
    
    1. 3-Hop Cycle Laundering Ring (True Positive)
    2. Gather-Scatter Structuring Network (True Positive)
    3. High-Velocity Payroll Flow Cleared by Graph AI (False Positive Eliminated)
    """
    scenarios = load_demo_scenarios()
    if not scenarios:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo scenarios not yet materialized. Run export script."
        )
    return {
        "count": len(scenarios),
        "scenarios": scenarios
    }


@app.post(
    "/api/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze Wallet / Account Risk"
)
@limiter.limit("10/minute")
async def analyze_wallet(request: Request, payload: AnalyzeRequest):
    """Analyze transaction payload with Graph ML, Threat Intel, SHAP, and Gemini XAI.
    
    Enforces:
    - 10 requests / minute rate limit per IP.
    - Public scam wallet blacklist lookup.
    - Zero data leakage & strict PII masking on outbound explanations.
    - Quant ROI savings calculation.
    """
    t_start = time.perf_counter()
    raw_entity = payload.entity_id.strip()
    masked_entity = mask_pii(raw_entity)

    # 1. Threat Intel Blacklist Verification
    threat_record = check_threat_intel(raw_entity)
    is_threat = threat_record is not None

    threat_hit = ThreatIntelHit(
        flagged=is_threat,
        category=threat_record.category if threat_record else None,
        risk_level=threat_record.risk_level if threat_record else None,
        source=threat_record.source if threat_record else None,
        description=threat_record.description if threat_record else None,
    )

    # 2. Build Subgraph & Compute Graph Features
    tx_list = payload.transactions or []
    nodes_map: Dict[str, GraphNode] = {}
    edges_list: List[GraphEdge] = []

    in_degrees: Dict[str, int] = {}
    out_degrees: Dict[str, int] = {}
    in_amounts: Dict[str, float] = {}
    out_amounts: Dict[str, float] = {}

    for tx in tx_list:
        s_masked = mask_pii(tx.source)
        t_masked = mask_pii(tx.target)

        # Track degrees
        out_degrees[tx.source] = out_degrees.get(tx.source, 0) + 1
        in_degrees[tx.target] = in_degrees.get(tx.target, 0) + 1
        out_amounts[tx.source] = out_amounts.get(tx.source, 0.0) + tx.amount
        in_amounts[tx.target] = in_amounts.get(tx.target, 0.0) + tx.amount

        # Add nodes
        if s_masked not in nodes_map:
            nodes_map[s_masked] = GraphNode(
                id=s_masked,
                label=f"Node {s_masked}",
                type="origin" if tx.source == raw_entity else "counterparty",
                pagerank=0.0005
            )
        if t_masked not in nodes_map:
            nodes_map[t_masked] = GraphNode(
                id=t_masked,
                label=f"Node {t_masked}",
                type="destination" if tx.target == raw_entity else "counterparty",
                pagerank=0.0005
            )

        edges_list.append(
            GraphEdge(
                source=s_masked,
                target=t_masked,
                amount=tx.amount,
                timestamp=tx.timestamp or datetime.now(timezone.utc).isoformat(),
                payment_format=tx.payment_format or "Credit Card",
                is_laundering=is_threat
            )
        )

    # Ensure focus entity node exists
    if masked_entity not in nodes_map:
        nodes_map[masked_entity] = GraphNode(
            id=masked_entity,
            label=f"Subject {masked_entity}",
            type="focus_entity",
            pagerank=0.001
        )

    # Detect Motifs: Cycle detection (DFS)
    has_cycle = False
    adjacency: Dict[str, List[str]] = {}
    for tx in tx_list:
        adjacency.setdefault(tx.source, []).append(tx.target)

    def _dfs_cycle(curr: str, visited: Set[str], rec_stack: Set[str]) -> bool:
        visited.add(curr)
        rec_stack.add(curr)
        for neighbor in adjacency.get(curr, []):
            if neighbor not in visited:
                if _dfs_cycle(neighbor, visited, rec_stack):
                    return True
            elif neighbor in rec_stack:
                return True
        rec_stack.remove(curr)
        return False

    visited_nodes = set()
    rec_stack_nodes = set()
    for n in adjacency:
        if n not in visited_nodes:
            if _dfs_cycle(n, visited_nodes, rec_stack_nodes):
                has_cycle = True
                break

    # Gather-Scatter Metric: 2 * fan_out * fan_in / (fan_out + fan_in + 1)
    f_out = out_degrees.get(raw_entity, 0)
    f_in = in_degrees.get(raw_entity, 0)
    gs_index = (2.0 * f_out * f_in) / (f_out + f_in + 1.0)
    is_gather_scatter = gs_index >= 1.5

    # 3. Construct 30-dim Feature Vector for XGBoost & Tree-SHAP
    feat_vec = np.zeros(len(FEATURE_NAMES), dtype=np.float32)
    tot_paid = out_amounts.get(raw_entity, 0.0)
    tot_rcv = in_amounts.get(raw_entity, 0.0)

    feat_vec[0] = tot_paid
    feat_vec[1] = tot_rcv
    feat_vec[2] = tot_paid - tot_rcv
    feat_vec[3] = float(f_out + f_in)  # burst_24h
    feat_vec[4] = float(f_out + f_in)  # burst_72h
    feat_vec[5] = 1.0                  # burstiness_ratio
    feat_vec[6] = float(f_out)         # src_out_degree
    feat_vec[7] = float(f_in)          # src_in_degree
    feat_vec[8] = float(f_out)         # src_fan_out
    feat_vec[9] = float(f_in)          # src_fan_in
    net_ratio = (tot_rcv - tot_paid) / (tot_rcv + tot_paid + 1.0)
    feat_vec[10] = net_ratio
    feat_vec[11] = gs_index
    feat_vec[12] = 1.0 if has_cycle else 0.0  # cycle2
    feat_vec[13] = 1.0 if has_cycle else 0.0  # cycle3
    feat_vec[14] = 0.001 if (f_out + f_in) > 5 else 0.0001
    feat_vec[28] = 1.0  # fmt_cc default

    # 4. Compute XGBoost probability and SHAP contributions
    model_prob, shap_contribs = EXPLAINER.explain_features(feat_vec, top_k=5)

    # If entity is directly on threat intel blacklist, escalate risk score
    if is_threat:
        risk_score = 99.5
        model_prob = 0.995
    else:
        # Scale to 0 - 100
        risk_score = float(np.clip(model_prob * 100.0, 1.0, 99.0))
        # Boost if cycle or gather-scatter detected
        if has_cycle:
            risk_score = max(risk_score, 92.0)
        elif is_gather_scatter:
            risk_score = max(risk_score, 85.0)

    # 5. Baseline vs FlowTrace Decision (PRD Benchmark Thresholds)
    # Baseline flags if large amount (>10k), high burst (>5 tx), or high fan-out (>5)
    base_score = (
        np.log1p(tot_paid) / 10.0 +
        np.log1p(f_out + f_in) / 3.0 +
        np.log1p(f_out) / 3.0
    )
    # Threshold at Recall >= 90%
    baseline_alert = bool(base_score >= 0.96 or is_threat)
    # FlowTrace threshold at Recall >= 90% (~0.098 probability or 20.0 score)
    flowtrace_alert = bool(risk_score >= 20.0 or is_threat)

    # 6. Quant ROI Savings
    if baseline_alert and not flowtrace_alert:
        # False Positive Eliminated by FlowTrace!
        roi = ROIMetrics(
            analyst_hours_saved=0.5,
            cost_savings_usd=25.0,
            alert_type="False Positive Cleared by Graph AI",
            compliance_verdict="CLEARED (Saved 0.5h compliance review)"
        )
    elif flowtrace_alert:
        roi = ROIMetrics(
            analyst_hours_saved=0.0,
            cost_savings_usd=0.0,
            alert_type="True Positive Suspicious Topology",
            compliance_verdict="FLAGGED (SAR Escalation Required)"
        )
    else:
        roi = ROIMetrics(
            analyst_hours_saved=0.0,
            cost_savings_usd=0.0,
            alert_type="Clean Low-Risk Flow",
            compliance_verdict="CLEARED (Standard Flow)"
        )

    # 7. Generate Gemini / Offline XAI Narrative
    motifs_dict = {
        "has_cycle": has_cycle,
        "is_gather_scatter": is_gather_scatter,
        "blacklisted": is_threat,
        "total_transactions": len(tx_list)
    }

    xai_narrative = EXPLAINER.explain_with_gemini(
        entity_id=raw_entity,
        risk_score=risk_score,
        top_contributions=shap_contribs,
        motifs=motifs_dict,
        timeout_seconds=2.0
    )

    t_elapsed = (time.perf_counter() - t_start) * 1000.0

    return AnalyzeResponse(
        entity_id=raw_entity,
        masked_entity=masked_entity,
        risk_score=round(risk_score, 1),
        risk_level=xai_narrative.risk_level,
        baseline_alert=baseline_alert,
        flowtrace_alert=flowtrace_alert,
        threat_intel=threat_hit,
        graph_nodes=list(nodes_map.values()),
        graph_edges=edges_list,
        shap_breakdown=shap_contribs,
        xai_narrative=xai_narrative,
        roi_savings=roi,
        execution_time_ms=round(t_elapsed, 2)
    )
