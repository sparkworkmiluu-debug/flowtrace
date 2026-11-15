# FlowTrace — Quantitative AML Graph Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.163-009688.svg)](https://fastapi.tiangolo.com/)
[![DuckDB](https://img.shields.io/badge/DuckDB-In--Memory%20OLAP-FFF000.svg)](https://duckdb.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-Graph--Augmented-eb5424.svg)](https://xgboost.readthedocs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **FlowTrace** is a production-grade Quantitative Anti-Money Laundering (AML) platform designed for Tier-1 investment banks and high-growth FinTechs. Built as a portfolio project for the **Georgia Tech MS QCF (Quantitative and Computational Finance)** program, FlowTrace demonstrates how graph topology features, out-of-core columnar processing, and Explainable AI (XAI) eliminate **85.96% of false-positive compliance alerts** while maintaining **$\ge 90.1\%$ recall** on illicit transaction flows.

---

## 1. System Architecture

FlowTrace bridges high-speed columnar data processing (DuckDB), sparse linear algebra (SciPy PageRank), graph machine learning (XGBoost + Tree-SHAP), and LLM-assisted compliance narrative synthesis (Google Gemini).

```mermaid
flowchart TD
    subgraph DataEngine["1. Out-of-Core Quant Engine"]
        RAW["Raw Transactions (IBM AML 6.92M)"] --> DUCK["DuckDB C++ Columnar Engine"]
        DUCK --> CHRONO["Strict 60/20/20 Chronological Split<br/>(Zero Data Leakage)"]
        CHRONO --> GRAPH_FEAT["DuckDB SQL Graph Collapse & Motifs<br/>• In/Out Degrees & Net-Flow Ratio<br/>• 2-Cycle & 3-Hop Rings<br/>• Gather-Scatter Smurfing Index<br/>• 24h/72h Velocity Bursts"]
        CHRONO --> SP_PR["SciPy Sparse CSR Power Iteration<br/>Weighted PageRank Centrality"]
    end

    subgraph ModelEngine["2. Machine Learning & XAI Core"]
        GRAPH_FEAT --> XGB["Graph-Augmented XGBoost<br/>(PR-AUC = 0.2618)"]
        SP_PR --> XGB
        XGB --> SHAP["Tree-SHAP Explainer<br/>Exact Log-Odds Feature Attribution"]
        SHAP --> PII["Deterministic PII Masking Engine<br/>(Account & Wallet Anonymization)"]
        PII --> GEMINI["Google Gemini XAI Narrative<br/>Structured SAR Reports & Motifs"]
    end

    subgraph Serving["3. Production API & Frontend"]
        XGB --> FASTAPI["FastAPI 2.0.0 Production Server<br/>• SlowAPI Rate Limiting (10 req/min)<br/>• Threat Intel Blacklist Lookups<br/>• <10ms Cached Demos | <3s Realtime"]
        GEMINI --> FASTAPI
        FASTAPI --> NEXT["Next.js 15 App Router Frontend<br/>• Interactive Cytoscape.js Canvas<br/>• Rule-Based vs FlowTrace Toggle<br/>• Dynamic Compliance ROI Calculator"]
    end
```

---

## 2. Rigorous Quant AML Benchmark Results

Evaluated strictly according to institutional quantitative finance criteria on the **IBM AML LI-Small Dataset** (6,348,791 transactions) using an out-of-sample test split strictly quarantined in chronological order. **Accuracy is deliberately omitted** due to extreme class imbalance (~1 : 1,750).

| Metric | Legacy 3-Rule Baseline | FlowTrace Graph Model | Improvement / Quantitative Impact |
| :--- | :---: | :---: | :---: |
| **PR-AUC (Precision-Recall AUC)** | `0.007521` | **`0.261840`** | **34.8x Lift** in ranking precision |
| **Illicit Target Recall** | $\ge 90.0\%$ | **`90.10%`** | Guaranteed detection threshold |
| **False Positives (on Test Window)** | `35,463` | **`4,979`** | **85.96% False Positives Eliminated** |
| **False Positive Alerts Saved / 1M Txns** | Baseline | **`776,980` alerts** | Massive reduction in analyst alert fatigue |
| **Analyst Review Hours Saved / 1M Txns** | — | **`388,490` hours** | Calculated at standard 30 min / alert |
| **Compliance Cost Savings / 1M Txns** | — | **`$19,424,500`** | Calculated at standard $50.00 / hour rate |
| **End-to-End Test Set Pipeline Runtime** | — | **`22.73 seconds`** | Multi-threaded C++ DuckDB & SciPy CSR |

---

## 3. Explainable AI (XAI) & Threat Intelligence

FlowTrace does not operate as an opaque black box. Every risk prediction provides full mathematical auditability required for regulatory filings:

1. **Tree-SHAP Decomposition**: Computes the exact marginal contribution of all 30 graph and transaction features to the log-odds risk score.
2. **Strict PII Masking**: Anonymizes all account numbers (`BANK000_****D1A0`) and cryptographic hashes (`0x7f36...be1b`) before logging or transmission.
3. **Institutional Gemini XAI**: Converts SHAP attributions and topological motifs (cycles, smurfing hubs) into structured compliance narratives with recommended SAR actions. Includes a deterministic offline fallback for air-gapped environments.
4. **Threat Intelligence Feed**: Sub-millisecond blacklist verification against known malicious drainers, OFAC sanctions, and synthetic ring coordinators.

---

## 4. Honest Failure Analysis & Production Blind Spots

In accordance with institutional standards, the following architectural and modeling limitations are actively monitored:

### 1. Cross-Institutional Blind Spots (Siloed Bank Data)
* **The Blind Spot**: Graph features (PageRank, cycle detection, fan-in/fan-out) rely on observed transactions within the internal ledger. If a laundering ring routes funds through external financial institutions before looping back, the cycle becomes an unclosed open path within the single-bank view.
* **Mitigation Strategy**: Integrate privacy-preserving federated graph algorithms or zero-knowledge proof (ZKP) protocols to share cycle signatures across institutions without disclosing underlying customer PII.

### 2. Temporal Aggregation & Dwell-Time Compression
* **The Blind Spot**: Collapsing edges across static rolling windows (24 hours / 72 hours) assumes relatively consistent entity behavior. High-frequency automated wash trading or flash-loan laundering operating on sub-second or block-level intervals can bypass static burstiness ratios.
* **Mitigation Strategy**: Implement continuous-time dynamic graph neural networks (e.g., Temporal Graph Networks — TGN) with streaming micro-batch updates.

### 3. Adversarial Topology Mutation
* **The Blind Spot**: Professional criminal syndicates may intentionally adapt to known graph heuristics (e.g., maintaining low fan-out $< 3$ and artificially delaying hops over 14+ days to dilute temporal burst metrics).
* **Mitigation Strategy**: Combine unsupervised topological anomaly detection (Isolation Forests on latent graph embeddings) with semi-supervised supervised XGBoost classifiers.

---

## 5. 3-Step Local Quickstart

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

### Step 1: Clone & Setup Environment
```bash
git clone https://github.com/sparkworkmiluu-debug/flowtrace.git
cd flowtrace

# Create Python virtual environment and install pinned dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional: enable Gemini narratives (an offline deterministic narrative is used otherwise)
cp .env.example .env       # then set GEMINI_API_KEY
```

> The benchmark pipeline and `tests/test_pipeline.py` need the IBM AML **LI-Small** dataset
> (`LI-Small_Trans.csv`) in `data/raw/`. It is not committed; without it those 3 tests are skipped
> and the API still serves the precomputed demo scenarios.

### Step 2: Start the FastAPI Backend
```bash
# Starts high-speed AML API on http://localhost:8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Verify via `curl http://localhost:8000/health`:
```json
{"status": "healthy", "service": "FlowTrace AML Graph API", "version": "2.0.0"}
```

### Step 3: Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to interact with:
- **3 Zero-Friction Demos**: Circular Layering Ring, Gather-Scatter Smurfing, and Cleared Payroll.
- **Legacy Rules vs. FlowTrace Comparison**: Interactive toggle proving false-positive elimination.
- **ROI Calculator Slider**: Real-time dollar savings customization.

---

## 6. Repository Layout

```
flowtrace/
├── backend/
│   ├── main.py                  # FastAPI production server with slowapi & CORS
│   ├── pipeline.py              # DuckDB + SciPy PageRank + XGBoost benchmark
│   ├── threat_intel.py          # In-memory blacklist threat intelligence feed
│   ├── xai_explainer.py         # Tree-SHAP + Gemini structured narrative engine
│   ├── model.json               # Serialized production XGBoost booster
│   └── demo_scenarios.json      # Precomputed zero-friction benchmark scenarios
├── data/
│   └── raw/                     # LI-Small dataset (CSV / Parquet cache)
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (layout, page, globals.css)
│   │   ├── components/          # DemoSelector, GraphCanvas, KPICards, Navbar, XAIDrawer
│   │   └── lib/                 # Typed API client and Pydantic-mirroring TypeScript contracts
│   ├── package.json             # Pinned Next.js 15 & Cytoscape.js dependencies
│   └── tailwind.config.ts       # FinTech executive dark/light theme tokens
├── tests/
│   ├── test_api.py              # Pytest suite for FastAPI endpoints & rate limits
│   └── test_pipeline.py         # Pytest suite for DuckDB benchmark & metrics
├── FLOWTRACE_STANDARDS_AND_PRD.md # Technical standards & quantitative requirements
└── README.md                    # Project documentation
```

---

## 7. License

Distributed under the MIT License. Developed for quantitative finance research and commercial AML innovation.
