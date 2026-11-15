"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import KPICards from "@/components/KPICards";
import DemoSelector from "@/components/DemoSelector";
import GraphCanvas from "@/components/GraphCanvas";
import XAIDrawer from "@/components/XAIDrawer";
import { fetchScenarios, analyzeEntity } from "@/lib/api";
import type {
  AnalyzeRequest,
  DemoScenario,
  GraphNode,
  GraphEdge,
  ShapContribution,
  XAINarrative,
  ROIMetrics,
} from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Main Dashboard Page — Phase 3 Public Interactive Frontend
 *
 * Orchestrates: KPI Cards → Demo Selector → Graph Canvas → XAI Drawer
 * ───────────────────────────────────────────────────────────────────── */

interface ActiveResult {
  riskScore: number;
  riskLevel: string;
  baselineAlert: boolean;
  flowtraceAlert: boolean;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  shapBreakdown: ShapContribution[];
  narrative: XAINarrative;
  roi: ROIMetrics;
  executionTime: number;
}

export default function DashboardPage() {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [result, setResult] = useState<ActiveResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load scenarios on mount
  useEffect(() => {
    fetchScenarios()
      .then((data) => setScenarios(data.scenarios))
      .catch((err) => console.warn("Scenarios not loaded:", err));
  }, []);

  // Select a precomputed demo scenario
  const handleSelectScenario = useCallback(
    (scenarioId: string) => {
      setError(null);
      const s = scenarios.find((sc) => sc.id === scenarioId);
      if (!s) return;

      setActiveScenario(scenarioId);
      setResult({
        riskScore: s.risk_score,
        riskLevel: s.xai_explanation.risk_level,
        baselineAlert: s.baseline_alert,
        flowtraceAlert: s.flowtrace_alert,
        graphNodes: s.nodes,
        graphEdges: s.edges,
        shapBreakdown: s.shap_breakdown,
        narrative: s.xai_explanation,
        roi: s.roi_savings,
        executionTime: 2.5, // precomputed
      });
      setDrawerOpen(true);
    },
    [scenarios]
  );

  // Analyze custom wallet via POST /api/analyze
  const handleAnalyze = useCallback(async (req: AnalyzeRequest) => {
    setIsLoading(true);
    setError(null);
    setActiveScenario(null);

    try {
      const res = await analyzeEntity(req);
      setResult({
        riskScore: res.risk_score,
        riskLevel: res.risk_level,
        baselineAlert: res.baseline_alert,
        flowtraceAlert: res.flowtrace_alert,
        graphNodes: res.graph_nodes,
        graphEdges: res.graph_edges,
        shapBreakdown: res.shap_breakdown,
        narrative: res.xai_narrative,
        roi: res.roi_savings,
        executionTime: res.execution_time_ms,
      });
      setDrawerOpen(true);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <KPICards />

        {/* Demo Selector */}
        <DemoSelector
          activeScenario={activeScenario}
          onSelectScenario={handleSelectScenario}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
        />

        {/* Error Banner */}
        {error && (
          <div
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "var(--risk-critical)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Graph Canvas */}
        {result && (
          <div className={`transition-all duration-300 ${drawerOpen ? "mr-[410px]" : ""}`}>
            <GraphCanvas
              nodes={result.graphNodes}
              edges={result.graphEdges}
              baselineAlert={result.baselineAlert}
              flowtraceAlert={result.flowtraceAlert}
              riskScore={result.riskScore}
              onNodeClick={(id) => {
                setDrawerOpen(true);
              }}
            />
          </div>
        )}

        {/* Empty state */}
        {!result && !isLoading && (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl"
            style={{
              background: "var(--bg-secondary)",
              border: "1px dashed var(--border-default)",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              className="mb-4 opacity-50"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Select a demo scenario or scan a wallet to begin
            </p>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8" style={{ color: "var(--accent)" }} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Running Graph ML analysis...
              </span>
            </div>
          </div>
        )}
      </main>

      {/* XAI & ROI Drawer */}
      {result && (
        <XAIDrawer
          riskScore={result.riskScore}
          riskLevel={result.riskLevel}
          narrative={result.narrative}
          shapBreakdown={result.shapBreakdown}
          roi={result.roi}
          executionTime={result.executionTime}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Footer */}
      <footer
        className="border-t py-4 text-center text-xs"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-muted)",
        }}
      >
        FlowTrace v3.0 — Graph AML Intelligence Platform • Built for Georgia Tech MS QCF
      </footer>
    </div>
  );
}
