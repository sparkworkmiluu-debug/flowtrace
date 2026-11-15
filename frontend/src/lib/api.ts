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
    throw new Error(await describeError(res));
  }
  return res.json();
}

/** Turn FastAPI / slowapi error bodies into a readable one-line message. */
async function describeError(res: Response): Promise<string> {
  if (res.status === 429) {
    return "Rate limit reached (10 scans per minute). Please wait a moment and try again.";
  }
  const raw = await res.text();
  let detail = raw;
  try {
    const body = JSON.parse(raw);
    if (Array.isArray(body?.detail)) {
      // Pydantic validation errors: [{loc: [...], msg: "..."}]
      detail = body.detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          [d.loc?.slice(1).join("."), d.msg].filter(Boolean).join(": ")
        )
        .join("; ");
    } else if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (typeof body?.error === "string") {
      detail = body.error;
    }
  } catch {
    // Non-JSON body (e.g. proxy error page) — fall through with raw text.
  }
  if (res.status >= 500 && !detail) {
    detail = "The FlowTrace API is unavailable.";
  }
  return `Analysis failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`;
}
