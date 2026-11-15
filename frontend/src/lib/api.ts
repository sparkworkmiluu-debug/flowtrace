/* ─────────────────────────────────────────────────────────────────────────────
 * FlowTrace API Client
 *
 * All requests go through Next.js rewrites → FastAPI backend at :8000
 * ───────────────────────────────────────────────────────────────────────── */

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  HealthResponse,
  ScenariosResponse,
} from "./types";

const BASE = ""; // Next.js rewrites handle proxying

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchScenarios(): Promise<ScenariosResponse> {
  const res = await fetch(`${BASE}/api/scenarios`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Scenarios fetch failed: ${res.status}`);
  return res.json();
}

export async function analyzeEntity(
  payload: AnalyzeRequest
): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${err}`);
  }
  return res.json();
}
