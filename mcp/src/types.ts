export type Environment = "prod" | "staging";
export type ChangeKind = "feature_flag" | "deploy" | "scale";
export type ChangeStatus = "pending" | "applied" | "rolled_back";
export type Risk = "high" | "medium" | "low";
export type Severity = "sev1" | "sev2" | "sev3";

export interface Service {
  name: string;
  owner: string;
  environment: Environment;
  replicas: number;
  version: string;
  traffic_pct: number;
  description: string;
}

export interface Flag {
  name: string;
  service: string;
  environment: Environment;
  enabled: boolean;
  rollout_pct: number;
  description: string;
}

export interface SLO {
  service: string;
  name: string;
  target_pct: number;
  current_pct: number;
  window: string;
}

export interface Incident {
  id: string;
  service: string;
  opened_at: string;
  resolved_at: string | null;
  severity: Severity;
  summary: string;
}

export interface Change {
  id: string;
  kind: ChangeKind;
  title: string;
  service: string;
  environment: Environment;
  status: ChangeStatus;
  risk: Risk;
  requested_by: string;
  summary: string;
  payload: Record<string, unknown>;
  rollback: string;
}

export interface Page {
  id: string;
  service: string;
  severity: Severity;
  message: string;
  created_at: string;
}

export interface Catalog {
  company: string;
  disclaimer: string;
  services: Service[];
  flags: Flag[];
  slos: SLO[];
  incidents: Incident[];
  changes: Change[];
  pages: Page[];
}

export const REQUIRED_CHANGE_IDS = ["CHG-1042", "CHG-1043", "CHG-1044"] as const;
