/* ─────────────────────────────────────────────────────────────────────────────
 * FlowTrace API TypeScript Contracts
 *
 * Mirrors the Pydantic schemas defined in backend/main.py exactly.
 * ───────────────────────────────────────────────────────────────────────── */

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  pagerank: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  timestamp: string;
  payment_format: string;
  is_laundering: boolean;
}

export interface ShapContribution {
  feature: string;
  label: string;
  value: number;
  shap_value: number;
  direction: "increases_risk" | "decreases_risk";
}

export interface XAINarrative {
  summary: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence_score: number;
  key_drivers: string[];
  graph_motif_analysis: string;
  recommended_action: string;
}

export interface ROIMetrics {
  analyst_hours_saved: number;
  cost_savings_usd: number;
  alert_type: string;
  compliance_verdict?: string;
}

export interface ThreatIntelHit {
  flagged: boolean;
  category: string | null;
  risk_level: string | null;
  source: string | null;
  description: string | null;
}

export interface AnalyzeResponse {
  entity_id: string;
  masked_entity: string;
  risk_score: number;
  risk_level: string;
  baseline_alert: boolean;
  flowtrace_alert: boolean;
  threat_intel: ThreatIntelHit;
  graph_nodes: GraphNode[];
  graph_edges: GraphEdge[];
  shap_breakdown: ShapContribution[];
  xai_narrative: XAINarrative;
  roi_savings: ROIMetrics;
  execution_time_ms: number;
}

export interface DemoScenario {
  id: string;
  name: string;
  category: string;
  flow_type: string;
  is_laundering: boolean;
  baseline_alert: boolean;
  flowtrace_alert: boolean;
  risk_score: number;
  target_account: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  shap_breakdown: ShapContribution[];
  xai_explanation: XAINarrative;
  roi_savings: ROIMetrics;
}

export interface ScenariosResponse {
  count: number;
  scenarios: DemoScenario[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  model_loaded: boolean;
  scenarios_ready: boolean;
}

export interface TransactionInput {
  source: string;
  target: string;
  amount: number;
  timestamp?: string;
  payment_format?: string;
}

export interface AnalyzeRequest {
  entity_id: string;
  transactions?: TransactionInput[];
  time_window_hours?: number;
}
