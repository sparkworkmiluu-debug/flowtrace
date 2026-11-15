"""FlowTrace Phase 2 API Test Suite.

Verifies:
1. Pydantic input validation on analyze payloads.
2. SlowAPI rate limiting (10 requests/minute per IP yields HTTP 429).
3. Strict PII masking across accounts, graph nodes, and XAI narratives.
4. Latency performance (<3s response time on both demo and live analyze endpoints).
5. Threat intelligence blacklist integration.
6. Quant ROI cost savings calculation for false positive alert mitigation.
"""

from __future__ import annotations

import time
from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient

from backend.main import app, limiter
from backend.xai_explainer import mask_pii
from backend.threat_intel import is_blacklisted, check_threat_intel


@pytest.fixture
def client():
    """Create isolated FastAPI test client with reset limiter."""
    limiter.reset()
    with TestClient(app) as test_client:
        yield test_client
    limiter.reset()


def test_health_endpoint(client: TestClient):
    """Verify /health returns 200 and operational system status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "FlowTrace AML Graph API"
    assert data["version"] == "2.0.0"
    assert data["model_loaded"] is True
    assert data["scenarios_ready"] is True


def test_demo_scenarios_endpoint_and_pii_masking(client: TestClient):
    """Verify /api/scenarios returns 3 precomputed, PII-masked scenarios."""
    t0 = time.perf_counter()
    response = client.get("/api/scenarios")
    elapsed = time.perf_counter() - t0

    assert response.status_code == 200
    # Strict latency requirement: < 1 second for precomputed demo scenarios
    assert elapsed < 1.0, f"Demo scenarios took {elapsed:.3f}s, must respond in < 1.0s"

    data = response.json()
    assert data["count"] == 3
    scenarios = data["scenarios"]
    assert len(scenarios) == 3

    expected_ids = {
        "scenario_cycle_laundering",
        "scenario_gather_scatter",
        "scenario_legitimate_payroll"
    }
    actual_ids = {s["id"] for s in scenarios}
    assert actual_ids == expected_ids

    for sc in scenarios:
        # Check required fields
        assert "nodes" in sc and len(sc["nodes"]) > 0
        assert "edges" in sc and len(sc["edges"]) > 0
        assert "risk_score" in sc and 0.0 <= sc["risk_score"] <= 100.0
        assert "baseline_alert" in sc
        assert "flowtrace_alert" in sc
        assert "shap_breakdown" in sc and len(sc["shap_breakdown"]) > 0
        assert "xai_explanation" in sc
        assert "roi_savings" in sc

        # Strict PII masking validation:
        # Unmasked raw accounts like "000_8017AD1A0" must NOT be in target_account or node IDs
        assert "_" not in sc["target_account"] or "BANK" in sc["target_account"], (
            f"Raw unmasked account leaked: {sc['target_account']}"
        )
        assert "****" in sc["target_account"], f"Account not masked: {sc['target_account']}"

        for node in sc["nodes"]:
            assert "****" in node["id"] or "..." in node["id"], (
                f"Node ID leaked unmasked PII: {node['id']}"
            )

        for edge in sc["edges"]:
            assert "****" in edge["source"] or "..." in edge["source"]
            assert "****" in edge["target"] or "..." in edge["target"]


def test_pydantic_input_validation(client: TestClient):
    """Verify strict Pydantic payload validation and error handling."""
    # 1. Missing entity_id -> HTTP 422
    res_missing = client.post("/api/analyze", json={})
    assert res_missing.status_code == 422

    # 2. entity_id too short -> HTTP 422
    res_short = client.post("/api/analyze", json={"entity_id": "a"})
    assert res_short.status_code == 422

    # 3. Invalid negative amount -> HTTP 422
    res_neg = client.post("/api/analyze", json={
        "entity_id": "0x1234567890abcdef1234567890abcdef12345678",
        "transactions": [
            {"source": "0x1111111111111111111111111111111111111111",
             "target": "0x2222222222222222222222222222222222222222",
             "amount": -500.0}
        ]
    })
    assert res_neg.status_code == 422

    # 4. Valid payload -> HTTP 200
    res_valid = client.post("/api/analyze", json={
        "entity_id": "0x1234567890abcdef1234567890abcdef12345678",
        "transactions": [
            {"source": "0x1234567890abcdef1234567890abcdef12345678",
             "target": "0x9999999999999999999999999999999999999999",
             "amount": 2500.0,
             "payment_format": "Credit Card"}
        ]
    })
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["risk_score"] >= 0.0
    assert data["masked_entity"].startswith("0x1234...")


def test_pii_masking_helper():
    """Verify mask_pii regex transformations for all entity types."""
    # IBM AML Bank format
    assert mask_pii("000_8017AD1A0") == "BANK000_****D1A0"
    assert mask_pii("025400_80219F420") == "BANK025400_****F420"
    
    # EVM / Ethereum addresses (42 hex chars)
    eth_addr = "0x7f367cc41522ce07553e823bf3be79a889debe1b"
    masked_eth = mask_pii(eth_addr)
    assert masked_eth == "0x7f36...be1b"
    assert eth_addr not in masked_eth

    # Raw account numbers
    assert mask_pii("8017AD1A0") == "ACCT_****D1A0"


def test_threat_intel_blacklist(client: TestClient):
    """Verify known scam wallets trigger threat intelligence alarms."""
    blacklisted_wallet = "0x7f367cc41522ce07553e823bf3be79a889debe1b"
    assert is_blacklisted(blacklisted_wallet) is True
    
    record = check_threat_intel(blacklisted_wallet)
    assert record is not None
    assert record.risk_level == "CRITICAL"
    assert "Drainer" in record.category

    # API call with blacklisted wallet
    res = client.post("/api/analyze", json={"entity_id": blacklisted_wallet})
    assert res.status_code == 200
    data = res.json()
    assert data["threat_intel"]["flagged"] is True
    assert data["threat_intel"]["risk_level"] == "CRITICAL"
    assert data["risk_score"] >= 95.0
    assert data["flowtrace_alert"] is True


def test_roi_savings_calculation(client: TestClient):
    """Verify false positive alert clearing produces Quant ROI metrics."""
    # High-velocity commercial merchant flow without cycles
    payload = {
        "entity_id": "BANK_MERCHANT_CORP_01",
        "transactions": [
            {"source": "BANK_MERCHANT_CORP_01", "target": f"EMPLOYEE_{i:03d}", "amount": 25000.0, "payment_format": "ACH"}
            for i in range(12)
        ]
    }
    res = client.post("/api/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    roi = data["roi_savings"]
    assert "analyst_hours_saved" in roi
    assert "cost_savings_usd" in roi
    assert roi["cost_savings_usd"] >= 0.0


def test_api_latency_under_3s(client: TestClient):
    """Verify POST /api/analyze responds in strictly less than 3 seconds."""
    payload = {
        "entity_id": "0x3333333333333333333333333333333333333333",
        "transactions": [
            {"source": "0x3333333333333333333333333333333333333333",
             "target": "0x4444444444444444444444444444444444444444",
             "amount": 12000.0}
        ]
    }
    t0 = time.perf_counter()
    res = client.post("/api/analyze", json=payload)
    elapsed = time.perf_counter() - t0

    assert res.status_code == 200
    assert elapsed < 3.0, f"Analyze endpoint took {elapsed:.2f}s, must be < 3.0s"
    data = res.json()
    assert data["execution_time_ms"] < 3000.0


def test_rate_limiting_10_req_per_minute(client: TestClient):
    """Verify slowapi limits requests to 10/minute per IP and yields HTTP 429."""
    limiter.reset()
    payload = {"entity_id": "0x5555555555555555555555555555555555555555"}
    
    statuses = []
    # Send 12 requests in rapid succession
    for _ in range(12):
        res = client.post("/api/analyze", json=payload)
        statuses.append(res.status_code)

    # First 10 should succeed (HTTP 200)
    assert statuses[:10] == [200] * 10
    # 11th and 12th should be blocked by rate limiter (HTTP 429)
    assert statuses[10] == 429
    assert statuses[11] == 429


def _fake_request(peer: str, forwarded: str | None = None):
    from starlette.requests import Request

    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


def test_rate_limit_key_separates_users_behind_local_proxy():
    """Behind the Next.js rewrite proxy (loopback peer), each end user gets their own bucket."""
    from backend.main import client_ip_key

    assert client_ip_key(_fake_request("127.0.0.1", "203.0.113.7, 10.0.0.1")) == "203.0.113.7"
    assert client_ip_key(_fake_request("127.0.0.1", "198.51.100.2")) == "198.51.100.2"
    # No forwarded header: fall back to the peer address.
    assert client_ip_key(_fake_request("127.0.0.1")) == "127.0.0.1"


def test_rate_limit_key_ignores_spoofed_forwarded_header():
    """A direct (non-proxy) client cannot dodge the limit by forging X-Forwarded-For."""
    from backend.main import client_ip_key

    assert client_ip_key(_fake_request("203.0.113.50", "1.2.3.4")) == "203.0.113.50"


def test_long_transaction_chain_does_not_overflow_recursion(client: TestClient):
    """A 1,500-hop chain must not crash cycle detection with RecursionError (HTTP 500)."""
    chain = [
        {"source": f"node_{i:05d}", "target": f"node_{i + 1:05d}", "amount": 10.0}
        for i in range(1500)
    ]
    res = client.post("/api/analyze", json={"entity_id": "node_00000", "transactions": chain})
    assert res.status_code == 200


def test_cycle_detection_on_ring(client: TestClient):
    """A closed 3-hop ring is still detected after the iterative DFS rewrite."""
    from backend.main import _graph_has_cycle

    assert _graph_has_cycle({"a": ["b"], "b": ["c"], "c": ["a"]}) is True
    assert _graph_has_cycle({"a": ["b", "c"], "b": ["c"], "c": []}) is False


def test_transaction_payload_size_is_capped(client: TestClient):
    """Oversized subgraphs are rejected with 422 instead of being processed."""
    from backend.main import MAX_TRANSACTIONS

    too_many = [
        {"source": "src_000", "target": f"dst_{i:05d}", "amount": 1.0}
        for i in range(MAX_TRANSACTIONS + 1)
    ]
    res = client.post("/api/analyze", json={"entity_id": "src_000", "transactions": too_many})
    assert res.status_code == 422
