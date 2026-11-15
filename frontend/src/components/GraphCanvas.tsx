"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GraphNode, GraphEdge } from "@/lib/types";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Upgraded Interactive Graph Canvas (Cytoscape.js)
 *
 * Features:
 * - Subtle dot-grid canvas background with dark/light mode support.
 * - Directional arrows with currency-formatted `$` amount labels on edges.
 * - Subtle glow & border highlights on hub and origin entities.
 * - Floating Zoom In (+), Zoom Out (-), Fit Graph (â›¶), and Reset (âŸ²) controls.
 * - Prominent Legacy Rules vs. FlowTrace Graph toggle with dynamic alert badges.
 * - Node inspection card displaying PageRank & connected metrics.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  baselineAlert: boolean;
  flowtraceAlert: boolean;
  riskScore: number;
  onNodeClick?: (nodeId: string) => void;
}

interface NodeDetails {
  id: string;
  label: string;
  type: string;
  pagerank: number;
  inDegree: number;
  outDegree: number;
  totalVolume: number;
}

function getNodeTheme(type: string, riskScore: number) {
  const isHighRisk = riskScore >= 70;
  const isMedRisk = riskScore >= 30;

  switch (type) {
    case "ring_origin":
    case "hub_aggregator":
    case "focus_entity":
      return {
        bg: isHighRisk ? "#ef4444" : isMedRisk ? "#f97316" : "#10b981",
        border: isHighRisk ? "#b91c1c" : isMedRisk ? "#c2410c" : "#047857",
        glow: isHighRisk ? "rgba(239, 68, 68, 0.55)" : "rgba(16, 185, 129, 0.55)",
        size: 40,
        isHub: true,
      };
    case "ring_hop":
    case "smurf_feeder":
      return {
        bg: "#fb923c",
        border: "#ea580c",
        glow: "rgba(251, 146, 60, 0.35)",
        size: 32,
        isHub: false,
      };
    case "dispersal_target":
      return {
        bg: "#facc15",
        border: "#ca8a04",
        glow: "rgba(250, 204, 21, 0.35)",
        size: 30,
        isHub: false,
      };
    case "corporate_payroll":
      return {
        bg: "#10b981",
        border: "#059669",
        glow: "rgba(16, 185, 129, 0.45)",
        size: 40,
        isHub: true,
      };
    case "employee_recipient":
      return {
        bg: "#34d399",
        border: "#059669",
        glow: "rgba(52, 211, 153, 0.35)",
        size: 30,
        isHub: false,
      };
    default:
      return {
        bg: "#64748b",
        border: "#475569",
        glow: "rgba(100, 116, 139, 0.3)",
        size: 30,
        isHub: false,
      };
  }
}

function getEdgeColor(isLaundering: boolean) {
  return isLaundering ? "#f43f5e" : "#10b981";
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
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<NodeDetails | null>(null);

  const initCytoscape = useCallback(async () => {
    if (!containerRef.current || nodes.length === 0) return;

    const cytoscape = (await import("cytoscape")).default;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#f1f5f9" : "#0f172a";
    const labelBgColor = isDark ? "#090d16" : "#ffffff";

    // Transform Nodes
    const cyNodes = nodes.map((n) => {
      const theme = getNodeTheme(n.type, riskScore);
      return {
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          pagerank: n.pagerank,
          color: theme.bg,
          borderColor: theme.border,
          glowColor: theme.glow,
          size: theme.size,
          borderWidth: theme.isHub ? 3.5 : 2,
        },
      };
    });

    // Transform Edges
    const cyEdges = edges.map((e, i) => {
      const edgeCol = getEdgeColor(e.is_laundering);
      const formattedAmount = `$${e.amount.toLocaleString(undefined, {
        minimumFractionDigits: e.amount % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`;

      return {
        data: {
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          amount: e.amount,
          is_laundering: e.is_laundering,
          label: formattedAmount,
          color: edgeCol,
          width: Math.max(2, Math.min(6.5, Math.log10(e.amount + 1) * 1.1)),
        },
      };
    });

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)" as any,
            "border-width": "data(borderWidth)" as any,
            "border-color": "data(borderColor)" as any,
            label: "data(label)",
            "font-size": "10px",
            "font-family": "Inter, system-ui, sans-serif",
            "font-weight": 600,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 8,
            color: textColor,
            "text-background-color": labelBgColor,
            "text-background-opacity": 0.85,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            width: "data(size)" as any,
            height: "data(size)" as any,
            "overlay-opacity": 0,
            "transition-property": "width, height, border-width, border-color",
            "transition-duration": "0.2s" as any,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4.5,
            "border-color": "#3b82f6",
            "border-opacity": 1,
            "background-color": "#2563eb",
            width: 46,
            height: 46,
          } as any,
        },
        {
          selector: "edge",
          style: {
            width: "data(width)" as any,
            "line-color": "data(color)" as any,
            "target-arrow-color": "data(color)" as any,
            "target-arrow-shape": "triangle",
            "arrow-scale": 1.25,
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "9px",
            "font-family": "JetBrains Mono, monospace",
            "font-weight": 600,
            "text-rotation": "autorotate",
            "text-margin-y": -7,
            color: textColor,
            "text-background-color": labelBgColor,
            "text-background-opacity": 0.88,
            "text-background-padding": "2px",
            "text-background-shape": "roundrectangle",
            opacity: 0.88,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 5,
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            opacity: 1,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 9000,
        idealEdgeLength: () => 140,
        edgeElasticity: () => 100,
        gravity: 0.25,
        padding: 50,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // Node click handler
    cy.on("tap", "node", (evt: any) => {
      const targetNode = evt.target;
      const id = targetNode.id();
      const nodeData = nodes.find((n) => n.id === id);

      if (nodeData) {
        // Calculate in/out degree & volume
        const inEdges = edges.filter((e) => e.target === id);
        const outEdges = edges.filter((e) => e.source === id);
        const totalVol = [...inEdges, ...outEdges].reduce((acc, e) => acc + e.amount, 0);

        setSelectedNodeDetails({
          id: nodeData.id,
          label: nodeData.label,
          type: nodeData.type,
          pagerank: nodeData.pagerank,
          inDegree: inEdges.length,
          outDegree: outEdges.length,
          totalVolume: totalVol,
        });
      }

      onNodeClick?.(id);
    });

    // Canvas click to deselect
    cy.on("tap", (evt: any) => {
      if (evt.target === cy) {
        setSelectedNodeDetails(null);
      }
    });

    cyRef.current = cy;
  }, [nodes, edges, riskScore, onNodeClick]);

  useEffect(() => {
    initCytoscape();
    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [initCytoscape]);

  // Floating Zoom & Layout Controls
  const handleZoomIn = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.zoom({
      level: cy.zoom() * 1.3,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  };

  const handleZoomOut = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.zoom({
      level: cy.zoom() / 1.3,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  };

  const handleFit = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 45);
  };

  const handleReset = () => {
    if (!cyRef.current) return;
    cyRef.current.reset();
  };

  const isAlert = showBaseline ? baselineAlert : flowtraceAlert;

  return (
    <div className="space-y-3.5">
      {/* Header Bar: Graph Title & Baseline / FlowTrace Comparison Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Transaction Topology Graph
          </span>
          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {nodes.length} Nodes â€¢ {edges.length} Edges
          </span>
        </div>

        {/* Prominent Legacy Rules vs FlowTrace Toggle */}
        <div
          className="glass-card px-3 py-1.5 rounded-xl border flex items-center gap-3 text-xs"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span
            className={`font-semibold cursor-pointer transition-colors ${
              showBaseline ? "text-rose-500 font-bold" : "text-slate-400"
            }`}
            onClick={() => setShowBaseline(true)}
          >
            Legacy Rules (Noisy)
          </span>

          <button
            onClick={() => setShowBaseline((p) => !p)}
            className="toggle-track shrink-0"
            style={{
              background: showBaseline ? "#e11d48" : "var(--accent)",
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
            className={`font-semibold cursor-pointer transition-colors ${
              !showBaseline ? "text-blue-500 font-bold" : "text-slate-400"
            }`}
            onClick={() => setShowBaseline(false)}
          >
            FlowTrace Graph (Filtered)
          </span>
        </div>
      </div>

      {/* Real-time Verdict Comparison Banner */}
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300"
        style={{
          background: isAlert
            ? "rgba(225, 29, 72, 0.08)"
            : "rgba(16, 185, 129, 0.08)",
          color: isAlert ? "var(--risk-critical)" : "var(--success)",
          border: `1px solid ${
            isAlert ? "rgba(225, 29, 72, 0.25)" : "rgba(16, 185, 129, 0.25)"
          }`,
        }}
      >
        <div className="flex items-center gap-2">
          <span>{isAlert ? "ðŸš¨" : "ðŸ›¡ï¸"}</span>
          <span>
            {showBaseline ? "Legacy 3-Rule Engine" : "FlowTrace Graph Model"}
            {" â€” "}
            <strong>
              {isAlert
                ? "AML ALERT TRIGGERED (SAR Escalation Required)"
                : "CLEARED AS LEGITIMATE (Zero False Alarm)"}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="hidden sm:inline" style={{ color: "var(--text-muted)" }}>
            Calibrated Risk:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-current/10">
            {riskScore.toFixed(1)} / 100
          </span>
        </div>
      </div>

      {/* Main Canvas Container with Dot-Grid Background & Floating Controls */}
      <div className="graph-canvas-wrapper relative shadow-sm">
        {/* Floating Zoom / Pan / Fit Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 glass-card p-1 shadow-md border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors hover:bg-blue-500/10 hover:text-blue-500"
            style={{ color: "var(--text-secondary)" }}
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors hover:bg-blue-500/10 hover:text-blue-500"
            style={{ color: "var(--text-secondary)" }}
          >
            âˆ’
          </button>
          <div className="h-px w-full" style={{ background: "var(--border-default)" }} />
          <button
            onClick={handleFit}
            title="Fit Graph to View"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-500"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            title="Reset Graph Layout"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors hover:bg-blue-500/10 hover:text-blue-500"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* Cytoscape Canvas with Dot-Grid Background */}
        <div ref={containerRef} className="dot-grid-bg cytoscape-container" />

        {/* Selected Node Inspection Overlay */}
        {selectedNodeDetails && (
          <div
            className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md glass-card p-3.5 rounded-xl border shadow-xl z-10 slide-in"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {selectedNodeDetails.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedNodeDetails(null)}
                className="text-xs px-1.5 py-0.5 rounded opacity-60 hover:opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                âœ•
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span style={{ color: "var(--text-muted)" }}>Role: </span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {selectedNodeDetails.type}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>PageRank: </span>
                <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {selectedNodeDetails.pagerank.toFixed(5)}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>In / Out Degree: </span>
                <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                  {selectedNodeDetails.inDegree} in / {selectedNodeDetails.outDegree} out
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Total Volume: </span>
                <span className="font-mono font-bold text-emerald-500">
                  ${selectedNodeDetails.totalVolume.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
