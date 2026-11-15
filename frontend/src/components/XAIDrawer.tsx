"use client";

import { useState } from "react";
import type { ShapContribution, XAINarrative, ROIMetrics } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Right XAI & ROI Drawer
 *
 * Shows: Risk Score gauge, Gemini XAI narrative, SHAP feature bars,
 * and an interactive ROI Calculator slider.
 * ───────────────────────────────────────────────────────────────────── */

interface Props {
  riskScore: number;
  riskLevel: string;
  narrative: XAINarrative | null;
  shapBreakdown: ShapContribution[];
  roi: ROIMetrics | null;
  executionTime: number;
  isOpen: boolean;
  onClose: () => void;
}

function riskColor(level: string): string {
  switch (level) {
    case "CRITICAL": return "var(--risk-critical)";
    case "HIGH": return "var(--risk-high)";
    case "MEDIUM": return "var(--risk-medium)";
    case "LOW": return "var(--risk-low)";
    default: return "var(--text-muted)";
  }
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const angle = (score / 100) * 180 - 90; // -90 to 90 degrees
  const color = riskColor(level);
  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-40 h-20 overflow-hidden">
        {/* Background arc */}
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 283} 283`}
          />
        </svg>
      </div>
      <div className="text-3xl font-bold -mt-4 font-mono tabular-nums" style={{ color }}>
        {score.toFixed(1)}
      </div>
      <div
        className="risk-badge mt-2 tabular-nums font-mono"
        style={{ background: `${color}15`, color, borderColor: `${color}40` }}
      >
        {level}
      </div>
    </div>
  );
}

function ShapBars({ contributions }: { contributions: ShapContribution[] }) {
  const maxAbs = Math.max(
    ...contributions.map((c) => Math.abs(c.shap_value)),
    0.01
  );

  return (
    <div className="space-y-2">
      {contributions.map((c) => {
        const pct = (Math.abs(c.shap_value) / maxAbs) * 100;
        const isPositive = c.direction === "increases_risk";
        return (
          <div key={c.feature} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className="truncate max-w-[180px]"
                style={{ color: "var(--text-secondary)" }}
                title={c.label}
              >
                {c.label}
              </span>
              <span
                className="font-mono text-xs font-semibold tabular-nums"
                style={{
                  color: isPositive ? "var(--risk-critical)" : "var(--risk-low)",
                }}
              >
                {c.shap_value > 0 ? "+" : ""}
                {c.shap_value.toFixed(3)}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isPositive ? "shap-bar-positive" : "shap-bar-negative"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ROICalculator({ roi }: { roi: ROIMetrics }) {
  const [hourlyRate, setHourlyRate] = useState(50);
  const fpSavedPerMillion = 87_571; // from pipeline benchmarks
  const hoursSavedPerMillion = fpSavedPerMillion * 0.5;
  // Figures are normalized per 1M transactions screened, not per year.
  const savingsPerMillion = hoursSavedPerMillion * hourlyRate;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>
          Analyst Hourly Rate
        </span>
        <span className="font-mono font-bold tabular-nums" style={{ color: "var(--accent)" }}>
          ${hourlyRate}/hr
        </span>
      </div>
      <input
        type="range"
        min={25}
        max={200}
        step={5}
        value={hourlyRate}
        onChange={(e) => setHourlyRate(Number(e.target.value))}
        aria-label="Analyst hourly rate in US dollars"
        className="w-full h-1.5 rounded-lg cursor-pointer accent-blue-500"
        style={{ background: "var(--bg-tertiary)" }}
      />
      <div className="flex justify-between text-xs font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
        <span>$25/hr</span>
        <span>$200/hr</span>
      </div>

      <div
        className="glass-card p-4 mt-2 space-y-2 border"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>FP Alerts Saved / 1M</span>
          <span className="font-mono font-bold tabular-nums">{fpSavedPerMillion.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Hours Saved / 1M</span>
          <span className="font-mono font-bold tabular-nums">{hoursSavedPerMillion.toLocaleString()}</span>
        </div>
        <div
          className="flex justify-between text-sm font-bold pt-2 border-t"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span style={{ color: "var(--text-primary)" }}>Savings / 1M Txns</span>
          <span className="font-mono font-bold tabular-nums" style={{ color: "var(--success)" }}>
            ${savingsPerMillion.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      {/* Current scenario ROI */}
      {roi.analyst_hours_saved > 0 && (
        <div
          className="text-xs px-3 py-2 rounded-lg font-mono tabular-nums"
          style={{
            background: "rgba(16,185,129,0.08)",
            color: "var(--success)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
        >
          ✅ This alert: {roi.analyst_hours_saved}h saved (${roi.cost_savings_usd.toFixed(2)}) — {roi.alert_type}
        </div>
      )}
    </div>
  );
}

export default function XAIDrawer({
  riskScore,
  riskLevel,
  narrative,
  shapBreakdown,
  roi,
  executionTime,
  isOpen,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      role="complementary"
      aria-label="XAI analysis and ROI"
      className="fixed top-16 right-0 bottom-0 w-full sm:w-[400px] z-40 slide-in overflow-y-auto border-l"
      style={{
        background: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Drawer Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b"
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          XAI Analysis & ROI
        </span>
        <button
          onClick={onClose}
          aria-label="Close analysis panel"
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
          }}
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Risk Gauge */}
        <RiskGauge score={riskScore} level={riskLevel} />

        {/* Execution time */}
        <div
          className="text-center text-xs font-mono tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          Analysis completed in {executionTime.toFixed(1)}ms
        </div>

        {/* XAI Narrative */}
        {narrative && (
          <div className="space-y-3">
            <h4
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Gemini XAI Narrative
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {narrative.summary}
            </p>

            <div
              className="text-xs p-3 rounded-lg space-y-1"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Graph Motif Analysis
              </div>
              <p style={{ color: "var(--text-secondary)" }}>
                {narrative.graph_motif_analysis}
              </p>
            </div>

            <div
              className="text-xs p-3 rounded-lg"
              style={{
                background: `${riskColor(riskLevel)}10`,
                color: riskColor(riskLevel),
                border: `1px solid ${riskColor(riskLevel)}20`,
              }}
            >
              <strong>Action:</strong> {narrative.recommended_action}
            </div>
          </div>
        )}

        {/* SHAP Feature Bars */}
        <div className="space-y-3">
          <h4
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Top SHAP Feature Contributions
          </h4>
          <ShapBars contributions={shapBreakdown} />
        </div>

        {/* ROI Calculator */}
        <div className="space-y-3">
          <h4
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            ROI Calculator
          </h4>
          {roi && <ROICalculator roi={roi} />}
        </div>
      </div>
    </div>
  );
}
