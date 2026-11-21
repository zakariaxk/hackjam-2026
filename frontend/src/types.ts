export type LatLon = [number, number];

export interface RanchConfig {
  name: string;
  county: string;
  acres: number;
  boundary: LatLon[];
  barn: { name: string; lat: number; lon: number };
  tags: {
    cow: { name: string; lat: number; lon: number };
    base: { name: string; lat: number; lon: number };
  };
  herd_center: { lat: number; lon: number };
  map_center: { lat: number; lon: number };
  zoom: number;
}

export interface LiveNode {
  id: string | null;
  role: "cow" | "base";
  name: string;
  reported_name: string | null;
  lat: number;
  lon: number;
  position_source: "radio" | "config";
  last_heard: number | null;
  battery: number | null;
}

export interface Alert {
  id: number;
  node_id: string | null;
  name: string;
  behavior: string;
  time: number;
  source: "lora" | "manual";
  trigger?: "motion" | "button" | "manual";
  via: string;
  portnum: string | null;
  lat: number;
  lon: number;
}

export interface TriageResult {
  parsed: boolean;
  risk?: "LOW" | "MEDIUM" | "HIGH";
  confidence?: number;
  findings?: string;
  recommended_action?: string;
  fdacs_report?: string;
  raw: string;
  model?: string;
}

export interface Flow {
  located_at: number | null;
  dispatched_at: number | null;
  scan_requested_at: number | null;
  scanned_at: number | null;
}

export interface Status {
  radio_online: boolean;
  radio_port: string | null;
  cow_id: string | null;
  base_id: string | null;
  nodes: LiveNode[];
  alert: Alert | null;
  alert_log: Alert[];
  scan_pending: boolean;
  analyzing: boolean;
  result: TriageResult | null;
  has_image: boolean;
  image_version: number;
  last_error: string | null;
  flow: Flow;
  camera_online: boolean;
  gemini_key: boolean;
  server_time: number;
}

export interface SimCow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  heading: number;
  flagged: boolean;
}
