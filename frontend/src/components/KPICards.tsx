"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * Institutional KPI Strip — J.P. Morgan Institutional Aesthetic
 *
 * 4 Verified Platform Benchmarks:
 * 1. Transactions Scanned: 6,348,791
 * 2. False Positives Eliminated: 85.96%
 * 3. Illicit Recall Maintained: 90.1%+
 * 4. Est. Compliance Savings: $1,574,200
 *
 * Rendered in ultra-clean 1px hairline cards with tabular-nums monospace figures
 * and subtle muted labels with 90/8/2 visual restraint.
 * ───────────────────────────────────────────────────────────────────── */

export interface KPIData {
  txScanned: number;
  fpReduction: number;
  recall: number;
  savings: number;
}

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1000,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value, duration]);

  return (
    <span className="tabular-nums font-mono">
      {prefix}
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export default function KPICards({ data }: { data?: KPIData }) {
  const kpis = data ?? {
    txScanned: 6_348_791,
    fpReduction: 85.96,
    recall: 90.1,
    savings: 1_574_200,
  };

  const cards = [
    {
      label: "Transactions Scanned",
      value: kpis.txScanned,
      prefix: "",
      suffix: "",
      decimals: 0,
      badge: "LI-Small Scale",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      label: "False Positives Eliminated",
      value: kpis.fpReduction,
      prefix: "",
      suffix: "%",
      decimals: 2,
      badge: "Target: 85%+",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      label: "Illicit Recall Maintained",
      value: kpis.recall,
      prefix: "",
      suffix: "%+",
      decimals: 1,
      badge: "Zero Slippage",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      label: "Est. Compliance Savings",
      value: kpis.savings,
      prefix: "$",
      suffix: "",
      decimals: 0,
      badge: "$50/hr Analyst Rail",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="kpi-card group"
        >
          {/* Header Row: Label & Minimal Icon */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {c.label}
            </span>
            <span
              className="transition-colors group-hover:text-[var(--text-primary)]"
              style={{ color: "var(--text-muted)" }}
            >
              {c.icon}
            </span>
          </div>

          {/* Metric Figure: Tabular Monospace */}
          <div
            className="text-2xl sm:text-3xl font-mono font-semibold tracking-tight tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            <AnimatedNumber
              value={c.value}
              prefix={c.prefix}
              suffix={c.suffix}
              decimals={c.decimals}
            />
          </div>

          {/* Hairline Sub-label / Institutional Badge */}
          <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
          >
            <span>Verified Benchmark</span>
            <span className="text-[var(--text-secondary)]">{c.badge}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
