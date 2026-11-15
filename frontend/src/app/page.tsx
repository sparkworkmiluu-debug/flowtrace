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
 * Main Dashboard Page — Refined Gemini Command Bar + J.P. Morgan Institutional
 *
 * Orchestration:
 * - When !result: Clean institutional KPI strip + Centered Hero Command Bar
 * - When result: Compact workspace view + Interactive Graph Canvas + XAI Drawer (xl:pr-[420px])
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
      if (!s) {
        // Cards are always rendered, but their data comes from the API.
        setError(
          scenarios.length === 0
            ? "Demo scenarios are unavailable — the FlowTrace API appears to be offline. Start the backend and reload."
            : `Scenario "${scenarioId}" was not found in the API response.`
        );
        return;
      }

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
        executionTime: 2.5, // precomputed benchmark latency
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
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stable identity so GraphCanvas doesn't rebuild the graph on every render.
  const handleNodeClick = useCallback(() => setDrawerOpen(true), []);

  // Reset to Hero Command Bar mode
  const handleReset = useCallback(() => {
    setResult(null);
    setActiveScenario(null);
    setDrawerOpen(false);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <Navbar />

      <main
        className={`flex-1 max-w-[1440px] mx-auto w-full px-6 py-6 space-y-6 transition-all duration-300 ease-in-out ${
          result && drawerOpen ? "xl:pr-[420px]" : ""
        }`}
      >
        {/* Institutional KPI Strip (Always visible: Top 4 Verified Metrics) */}
        <KPICards />

        {/* Gemini-Style Command Bar: Hero Mode (!result) vs Compact Workspace (result) */}
        <section id="demo" className="scroll-mt-20">
          <DemoSelector
            activeScenario={activeScenario}
            onSelectScenario={handleSelectScenario}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            hasResult={Boolean(result)}
            onReset={handleReset}
          />
        </section>

        {/* Error Notification Banner */}
        {error && (
          <div
            role="alert"
            className="px-4 py-3 rounded-xl text-sm border flex items-center justify-between gap-3"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "var(--risk-critical)",
              borderColor: "rgba(239,68,68,0.25)",
            }}
          >
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-xs font-mono opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Interactive Graph Canvas (Visible when scan/scenario result is active) */}
        {result && (
          <div className="w-full transition-all duration-300 animate-fadeIn">
            <GraphCanvas
              nodes={result.graphNodes}
              edges={result.graphEdges}
              baselineAlert={result.baselineAlert}
              flowtraceAlert={result.flowtraceAlert}
              riskScore={result.riskScore}
              onNodeClick={handleNodeClick}
            />
          </div>
        )}

        {/* Loading Spinner with Institutional Monospace Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8" style={{ color: "var(--accent)" }} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-xs font-mono tracking-wide" style={{ color: "var(--text-muted)" }}>
                Evaluating Graph Motifs & Topology Risk...
              </span>
            </div>
          </div>
        )}
      </main>

      {/* XAI & Counterfactual ROI Drawer */}
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

      {/* Minimal Institutional Footer */}
      <footer
        className="border-t py-4 text-center text-xs"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-muted)",
        }}
      >
        FlowTrace v3.0 — Graph AML Intelligence Platform • Georgia Tech MS QCF Capstone
      </footer>
    </div>
  );
}
