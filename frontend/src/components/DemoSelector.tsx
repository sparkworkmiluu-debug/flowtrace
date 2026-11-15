"use client";

import { useState } from "react";
import type { AnalyzeRequest } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * Demo Selector & Command Bar — Gemini Command Bar + J.P. Morgan Institutional Aesthetic
 *
 * Mode A (Hero Command Bar, !hasResult):
 *   - Centered, spacious hero layout
 *   - Headline: "Verify any wallet or transaction ring before you settle"
 *   - Pill-shaped search input with integrated "Scan Risk" button inside right edge
 *   - 3 Curated FinTech demo scenarios rendered underneath as sleek, hairline-bordered cards
 *
 * Mode B (Compact Workspace Bar, hasResult):
 *   - Streamlined institutional toolbar for scenario switching and instant entity re-scanning
 * ───────────────────────────────────────────────────────────────────── */

export interface ScenarioItem {
  id: string;
  name: string;
  flowType: string;
  desc: string;
  badge: "TRUE POSITIVE" | "FALSE POSITIVE CLEARED";
  badgeVariant: "tp" | "fpc";
  riskScore: string;
}

export const SCENARIOS: ScenarioItem[] = [
  {
    id: "scenario_cycle_laundering",
    name: "Cycle Laundering Ring",
    flowType: "Circular 3-Hop Layering",
    desc: "Closed synthetic cycle routing illicit funds back to origin entity to conceal provenance.",
    badge: "TRUE POSITIVE",
    badgeVariant: "tp",
    riskScore: "94.5",
  },
  {
    id: "scenario_gather_scatter",
    name: "Gather-Scatter Cluster",
    flowType: "Smurfing / Structuring",
    desc: "High-density consolidation of multi-feeder smurf deposits rapidly dispersed to mule accounts.",
    badge: "TRUE POSITIVE",
    badgeVariant: "tp",
    riskScore: "88.2",
  },
  {
    id: "scenario_legitimate_payroll",
    name: "Commercial Payroll Flow",
    flowType: "Legitimate Merchant Rail",
    desc: "High-velocity corporate payroll flagged by legacy rules but cleared by FlowTrace Graph AI.",
    badge: "FALSE POSITIVE CLEARED",
    badgeVariant: "fpc",
    riskScore: "8.4",
  },
];

interface Props {
  activeScenario: string | null;
  onSelectScenario: (id: string) => void;
  onAnalyze: (req: AnalyzeRequest) => void;
  isLoading: boolean;
  hasResult?: boolean;
  onReset?: () => void;
}

export default function DemoSelector({
  activeScenario,
  onSelectScenario,
  onAnalyze,
  isLoading,
  hasResult = false,
  onReset,
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
    onAnalyze({ entity_id: sample, transactions: [], time_window_hours: 24 });
  };

  /* ─────────────────────────────────────────────────────────────────────
   * Mode A: Centered Hero Command Bar (when !hasResult)
   * ───────────────────────────────────────────────────────────────── */
  if (!hasResult) {
    return (
      <div className="py-8 md:py-12 max-w-4xl mx-auto flex flex-col items-center text-center space-y-8">
        {/* Institutional Eyebrow & Hero Headline */}
        <div className="space-y-3 max-w-2xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono uppercase tracking-wider"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Institutional AML Graph Intelligence
          </div>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Verify any wallet or transaction ring before you settle
          </h1>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Screen counterparty accounts, detect smurfing and circular layering, and eliminate false positives in real-time.
          </p>
        </div>

        {/* Gemini-style Pill-shaped Command Input with Integrated "Scan Risk" Button */}
        <div className="w-full max-w-2xl space-y-3">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center w-full rounded-full border transition-all duration-200"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-card)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div
              className="pl-5 pr-2 pointer-events-none shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="Enter wallet address or entity ID (e.g. 000_8017AD1A0 or 0x7f36...)"
              className="w-full py-3.5 pl-2 pr-32 bg-transparent text-xs sm:text-sm font-mono outline-none rounded-full"
              style={{ color: "var(--text-primary)" }}
              minLength={3}
              disabled={isLoading}
            />
            {walletInput && (
              <button
                type="button"
                onClick={() => setWalletInput("")}
                className="absolute right-28 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100 p-1"
                style={{ color: "var(--text-muted)" }}
                aria-label="Clear input"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || walletInput.trim().length < 3}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-5 py-2 text-xs font-semibold btn-primary disabled:opacity-40 disabled:cursor-not-allowed shrink-0 inline-flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="hidden sm:inline">Scanning...</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Scan Risk</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Sample Paste Button */}
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Or analyze benchmark sample:</span>
            <button
              type="button"
              onClick={() => handleQuickPaste("000_8017AD1A0")}
              className="font-mono text-[11px] px-2 py-0.5 rounded border transition-colors hover:border-[var(--accent)]"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
              }}
            >
              000_8017AD1A0
            </button>
          </div>
        </div>

        {/* 3 Sleek Hairline-Bordered Suggestion Cards Underneath */}
        <div className="w-full max-w-4xl text-left space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Curated Financial Crime Topologies
            </span>
            <span
              className="text-[11px] font-mono hidden sm:inline"
              style={{ color: "var(--text-muted)" }}
            >
              Click any card to inspect subgraph
            </span>
          </div>

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
                    {/* Card Header: Badge & Tabular Risk Score */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={s.badgeVariant === "tp" ? "badge-tp" : "badge-fpc"}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {s.badge}
                      </span>
                      <span
                        className="text-xs font-mono font-semibold tabular-nums"
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

                    {/* Card Title & Flow Subtitle */}
                    <div className="mb-2">
                      <h4
                        className="font-semibold text-sm leading-tight group-hover:text-blue-500 transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {s.name}
                      </h4>
                      <div
                        className="text-[11px] font-mono mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {s.flowType}
                      </div>
                    </div>

                    {/* Description */}
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {s.desc}
                    </p>
                  </div>

                  {/* Card Footer Indicator */}
                  <div
                    className="pt-2.5 mt-3 border-t flex items-center justify-between text-[11px]"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
                  >
                    <span>Inspect Subgraph</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
   * Mode B: Compact Workspace Command Bar (when hasResult is true)
   * ───────────────────────────────────────────────────────────────── */
  return (
    <div
      className="glass-card p-3 rounded-xl border flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between transition-all"
      style={{ borderColor: "var(--border-default)" }}
    >
      {/* Left: Quick Scenario Switcher Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline shrink-0 mr-1"
          style={{ color: "var(--text-muted)" }}
        >
          Scenarios:
        </span>
        {SCENARIOS.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectScenario(s.id)}
              disabled={isLoading}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium shrink-0 transition-all flex items-center gap-1.5 ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] hover:border-[var(--accent)] text-[var(--text-secondary)]"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    s.badgeVariant === "tp"
                      ? "var(--risk-critical)"
                      : "var(--success)",
                }}
              />
              <span>{s.name}</span>
              <span className="font-mono text-[10px] tabular-nums opacity-75">
                ({s.riskScore})
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Integrated Compact Search Pill & Reset Button */}
      <div className="flex items-center gap-2 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center rounded-full border flex-1 sm:w-80"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-secondary)",
          }}
        >
          <div
            className="pl-3.5 pr-1.5 pointer-events-none text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="Scan another wallet..."
            className="w-full py-1.5 pl-1 pr-24 bg-transparent text-xs font-mono outline-none rounded-full"
            style={{ color: "var(--text-primary)" }}
            minLength={3}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || walletInput.trim().length < 3}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] font-semibold btn-primary disabled:opacity-40"
          >
            {isLoading ? "..." : "Scan"}
          </button>
        </form>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Return to Hero Command Bar"
            className="px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors hover:border-[var(--accent)] shrink-0"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-secondary)",
              color: "var(--text-muted)",
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
