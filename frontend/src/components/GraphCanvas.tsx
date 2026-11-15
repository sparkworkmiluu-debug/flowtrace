"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GraphNode, GraphEdge } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Interactive Graph Canvas — Cytoscape.js force-directed graph
 *
 * Renders graph_nodes and graph_edges with color-coded risk levels,
 * node click inspection, and Baseline vs FlowTrace toggle.
 * ───────────────────────────────────────────────────────────────────── */

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  baselineAlert: boolean;
  flowtraceAlert: boolean;
  riskScore: number;
  onNodeClick?: (nodeId: string) => void;
}

function nodeColor(type: string, riskScore: number): string {
  if (type === "ring_origin" || type === "hub_aggregator" || type === "focus_entity")
    return riskScore >= 80 ? "#ef4444" : riskScore >= 50 ? "#f97316" : "#22c55e";
  if (type === "ring_hop" || type === "smurf_feeder") return "#f97316";
  if (type === "dispersal_target") return "#eab308";
  if (type === "corporate_payroll") return "#22c55e";
  if (type === "employee_recipient") return "#10b981";
  return "#64748b";
}

function edgeColor(isLaundering: boolean): string {
  return isLaundering ? "#ef4444" : "#4ade80";
}

export default function GraphCanvas({
  nodes,
  edges,
  baselineAlert,
  flowtraceAlert,
  riskScore,
  onNodeClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const initCytoscape = useCallback(async () => {
    if (!containerRef.current || nodes.length === 0) return;

    // Dynamic import to avoid SSR issues
    const cytoscape = (await import("cytoscape")).default;

    // Build elements
    const cyNodes = nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        pagerank: n.pagerank,
        color: nodeColor(n.type, riskScore),
      },
    }));

    const cyEdges = edges.map((e, i) => ({
      data: {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        amount: e.amount,
        is_laundering: e.is_laundering,
        label: `$${e.amount.toLocaleString()}`,
        color: edgeColor(e.is_laundering),
        width: Math.max(1.5, Math.min(6, Math.log10(e.amount + 1))),
      },
    }));

    // Destroy previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#e2e8f0" : "#1e293b";
    const bgColor = isDark ? "#111827" : "#f8fafc";

    containerRef.current.style.backgroundColor = bgColor;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)" as any,
            label: "data(label)",
            "font-size": "10px",
            "font-family": "Inter, system-ui, sans-serif",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 8,
            color: textColor,
            "text-outline-color": bgColor,
            "text-outline-width": 2,
            width: 32,
            height: 32,
            "border-width": 2,
            "border-color": "data(color)" as any,
            "border-opacity": 0.4,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#338dff",
            width: 42,
            height: 42,
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(width)" as any,
            "line-color": "data(color)" as any,
            "target-arrow-color": "data(color)" as any,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "8px",
            "font-family": "JetBrains Mono, monospace",
            "text-rotation": "autorotate",
            color: textColor,
            "text-outline-color": bgColor,
            "text-outline-width": 1.5,
            opacity: 0.85,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        animationDuration: 600,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.3,
        padding: 40,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt: any) => {
      const id = evt.target.id();
      setSelectedNode(id);
      onNodeClick?.(id);
    });

    cyRef.current = cy;
  }, [nodes, edges, riskScore, onNodeClick]);

  useEffect(() => {
    initCytoscape();
    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [initCytoscape]);

  // Determine badge for overlay
  const isAlert = showBaseline ? baselineAlert : flowtraceAlert;

  return (
    <div className="space-y-3">
      {/* Toggle header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Transaction Graph
        </h3>

        {/* Baseline vs FlowTrace Toggle */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <span
            style={{
              color: showBaseline ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            Legacy Rules (Noisy)
          </span>
          <button
            onClick={() => setShowBaseline((p) => !p)}
            className="toggle-track"
            style={{
              background: showBaseline ? "#ef4444" : "var(--accent)",
            }}
            aria-label="Toggle between Legacy Rules and FlowTrace"
          >
            <div
              className="toggle-thumb"
              style={{
                transform: showBaseline
                  ? "translateX(0)"
                  : "translateX(1.75rem)",
              }}
            />
          </button>
          <span
            style={{
              color: !showBaseline
                ? "var(--text-primary)"
                : "var(--text-muted)",
            }}
          >
            FlowTrace Graph (Filtered)
          </span>
        </div>
      </div>

      {/* Alert overlay banner */}
      <div
        className="flex items-center justify-between px-4 py-2 rounded-lg text-xs font-semibold"
        style={{
          background: isAlert
            ? "rgba(239,68,68,0.1)"
            : "rgba(16,185,129,0.1)",
          color: isAlert ? "var(--risk-critical)" : "var(--success)",
          border: `1px solid ${isAlert ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
        }}
      >
        <span>
          {showBaseline ? "⚠️ Legacy Rules" : "🔬 FlowTrace Graph AI"}
          {" — "}
          {isAlert ? "ALERT TRIGGERED" : "CLEARED (No Alert)"}
        </span>
        <span className="font-mono">
          Risk: {riskScore.toFixed(1)}/100
        </span>
      </div>

      {/* Cytoscape container */}
      <div ref={containerRef} className="cytoscape-container" />

      {/* Selected node info */}
      {selectedNode && (
        <div
          className="px-4 py-2 rounded-lg text-xs font-mono"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
          }}
        >
          Selected: <strong>{selectedNode}</strong>
        </div>
      )}
    </div>
  );
}
