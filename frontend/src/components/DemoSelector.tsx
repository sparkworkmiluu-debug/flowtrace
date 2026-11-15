"use client";

import { useState } from "react";
import type { AnalyzeRequest } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Demo Selector — Institutional FinTech Aesthetic (Stripe/Linear Inspired)
 *
 * 3 Zero-Friction Scenario Cards with Micro-Hover Lift,
 * Status Badges (TRUE POSITIVE / FALSE POSITIVE CLEARED),
 * and Sleek Public Wallet/Account Risk Scanner.
 * ───────────────────────────────────────────────────────────────────── */

interface ScenarioItem {
  id: string;
  name: string;
  flowType: string;
  desc: string;
  badge: "TRUE POSITIVE" | "FALSE POSITIVE CLEARED";
  badgeVariant: "tp" | "fpc";
  riskScore: string;
  iconBg: string;
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: "scenario_cycle_laundering",
    name: "Cycle Laundering Ring",
    flowType: "Circular 3-Hop Layering",
    desc: "Closed synthetic cycle routing funds back to origin entity to conceal provenance.",
    badge: "TRUE POSITIVE",
    badgeVariant: "tp",
    riskScore: "94.5",
    iconBg: "from-rose-500/20 to-red-600/30 text-rose-500",
  },
  {
    id: "scenario_gather_scatter",
    name: "Gather-Scatter Cluster",
    flowType: "Smurfing / Structuring",
    desc: "High-density consolidation of multi-feeder smurf deposits rapidly dispersed to mule accounts.",
    badge: "TRUE POSITIVE",
    badgeVariant: "tp",
    riskScore: "88.2",
    iconBg: "from-amber-500/20 to-orange-600/30 text-amber-500",
  },
  {
    id: "scenario_legitimate_payroll",
    name: "Commercial Payroll Flow",
    flowType: "Legitimate Merchant Rail",
    desc: "High-velocity corporate payroll flagged by legacy rules but cleared by FlowTrace Graph AI.",
    badge: "FALSE POSITIVE CLEARED",
    badgeVariant: "fpc",
    riskScore: "8.4",
    iconBg: "from-emerald-500/20 to-teal-600/30 text-emerald-500",
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

  const handleQuickPaste = (sample: string) => {
    setWalletInput(sample);
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Zero-Friction Scenarios
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            1-Click Benchmark Demos
          </span>
        </div>
        <span
          className="text-xs hidden sm:inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          Institutional AML LI-Small Dataset
        </span>
      </div>

      {/* 3 Crisp Glassmorphic Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {SCENARIOS.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectScenario(s.id)}
              disabled={isLoading}
              className={`btn-scenario-card group text-left ${isActive ? "active" : ""}`}
            >
              <div>
                {/* Card Top Row: Badge & Flow Tag */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className={s.badgeVariant === "tp" ? "badge-tp" : "badge-fpc"}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {s.badge}
                  </span>
                  <span
                    className="text-[11px] font-mono font-semibold"
                    style={{
                      color:
                        s.badgeVariant === "tp"
                          ? "var(--risk-critical)"
                          : "var(--success)",
                    }}
                  >
                    Score: {s.riskScore}
                  </span>
                </div>

                {/* Card Title & Icon */}
                <div className="flex items-start gap-2.5 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 mt-0.5 ${s.iconBg}`}
                  >
                    {s.badgeVariant === "tp" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h4
                      className="font-semibold text-sm leading-tight group-hover:text-blue-500 transition-colors"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {s.name}
                    </h4>
                    <span
                      className="text-[11px] font-mono tracking-tight"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.flowType}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p
                  className="text-xs leading-relaxed mt-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.desc}
                </p>
              </div>

              {/* Card Footer indicator */}
              <div
                className="pt-3 mt-3 border-t flex items-center justify-between text-[11px]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
              >
                <span>Click to inspect subgraph</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`transition-transform duration-200 ${isActive ? "translate-x-1 text-blue-500" : "group-hover:translate-x-1"}`}
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Institutional Wallet / Account Scanner Input Box */}
      <div
        className="glass-card p-3 rounded-xl border flex flex-col sm:flex-row gap-2.5 items-center"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="relative flex-1 w-full">
          <div
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(e);
            }}
            placeholder="Scan wallet address, bank account, or threat intel entity (e.g. 000_8017AD1A0 or 0x7f36...)"
            className="w-full pl-10 pr-20 py-2.5 rounded-lg text-xs sm:text-sm font-mono outline-none transition-all"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            minLength={3}
            disabled={isLoading}
          />
          {walletInput && (
            <button
              type="button"
              onClick={() => setWalletInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Sample Links & Scan Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => handleQuickPaste("000_8017AD1A0")}
            className="text-[11px] font-mono px-2 py-1.5 rounded border hidden lg:inline-block transition-colors hover:border-blue-500"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-secondary)",
              color: "var(--text-muted)",
            }}
          >
            Sample: 000_8017AD1A0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || walletInput.trim().length < 3}
            className="btn-primary w-full sm:w-auto px-6 py-2.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Analyzing Graph...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Scan Risk</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
