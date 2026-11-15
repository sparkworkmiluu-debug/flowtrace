"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@/lib/types";
import { fetchHealth } from "@/lib/api";

/* ─────────────────────────────────────────────────────────────────────────
 * Top Navbar Component
 *
 * FlowTrace branding, API health badge, dark/light mode toggle,
 * and navigation links (Live Demo, GitHub, Research Memo).
 * ───────────────────────────────────────────────────────────────────── */

const REPO_URL = "https://github.com/sparkworkmiluu-debug/flowtrace";

export default function Navbar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
    const interval = setInterval(() => {
      fetchHealth()
        .then(setHealth)
        .catch(() => setHealth(null));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  const isHealthy = health?.status === "healthy";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        background: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-between px-6 h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">
            Flow<span style={{ color: "var(--accent)" }}>Trace</span>
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: "var(--accent-glow)",
              color: "var(--accent)",
            }}
          >
            v3.0
          </span>
        </div>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <a href="#demo" className="hover:opacity-80 transition-opacity">
            Live Demo
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            GitHub
          </a>
          {/* No in-page #research section exists; the research write-up lives in the README. */}
          <a
            href={`${REPO_URL}#readme`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            Research Memo
          </a>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-4">
          {/* API Health Badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: isHealthy
                ? "rgba(16,185,129,0.1)"
                : "rgba(239,68,68,0.1)",
              color: isHealthy ? "var(--success)" : "var(--risk-critical)",
            }}
          >
            <span
              className="pulse-dot"
              style={{
                background: isHealthy ? "var(--success)" : "var(--risk-critical)",
              }}
            />
            {isHealthy ? "API Online" : "API Offline"}
          </div>

          {/* Dark / Light toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
