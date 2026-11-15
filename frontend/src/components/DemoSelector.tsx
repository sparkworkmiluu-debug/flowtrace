"use client";

import { useState } from "react";
import type { AnalyzeRequest } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Demo Selector — 3 Zero-Friction Scenario Buttons + Wallet Scanner
 * ───────────────────────────────────────────────────────────────────── */

const SCENARIOS = [
  {
    id: "scenario_cycle_laundering",
    label: "Cycle Laundering Ring",
    desc: "3-hop circular layering — True Positive",
    icon: "🔴",
    color: "#ef4444",
  },
  {
    id: "scenario_gather_scatter",
    label: "Gather-Scatter Cluster",
    desc: "Smurfing fan-in/fan-out hub — True Positive",
    icon: "🟠",
    color: "#f97316",
  },
  {
    id: "scenario_legitimate_payroll",
    label: "Legitimate Payroll Cleared",
    desc: "FP eliminated by FlowTrace Graph AI",
    icon: "🟢",
    color: "#22c55e",
  },
];

interface Props {
  activeScenario: string | null;
  onSelectScenario: (id: string) => void;
  onAnalyze: (req: AnalyzeRequest) => void;
  isLoading: boolean;
}

export default function DemoSelector({
  activeScenario,
  onSelectScenario,
  onAnalyze,
  isLoading,
}: Props) {
  const [walletInput, setWalletInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = walletInput.trim();
    if (trimmed.length < 3) return;
    onAnalyze({ entity_id: trimmed, transactions: [], time_window_hours: 24 });
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Zero-Friction Demo
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--border-default)" }}
        />
      </div>

      {/* 3 scenario buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectScenario(s.id)}
            disabled={isLoading}
            className={`btn-scenario ${
              activeScenario === s.id ? "active" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{s.icon}</span>
              <span
                className="font-semibold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {s.label}
              </span>
            </div>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {s.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Wallet / Account Risk Scanner */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={walletInput}
          onChange={(e) => setWalletInput(e.target.value)}
          placeholder="Enter wallet address or bank account ID to scan..."
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-mono outline-none transition-all"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
          minLength={3}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || walletInput.trim().length < 3}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          Scan
        </button>
      </form>
    </div>
  );
}
