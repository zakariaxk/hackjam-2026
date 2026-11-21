import { useEffect, useRef, useState } from "react";
import type { LatLon, RanchConfig, SimCow } from "./types";

/* ---------- geometry helpers ---------- */

const M_PER_DEG_LAT = 111_320;
const mPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

export function pointInPolygon(lat: number, lon: number, poly: LatLon[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (bLat - aLat) * M_PER_DEG_LAT;
  const dx = (bLon - aLon) * mPerDegLon(aLat);
  return Math.hypot(dx, dy);
}

export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (bLat - aLat) * M_PER_DEG_LAT;
  const dx = (bLon - aLon) * mPerDegLon(aLat);
  return (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = north, clockwise
}

/* ---------- deterministic RNG so the herd looks the same on every screen ---------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HERD_SIZE = 40;
const TICK_MS = 250;
const HERD_RADIUS_M = 170;
const STEP_M = 0.55; // per tick ≈ 2.2 m/s on screen — reads as slow grazing at ranch zoom

function seedHerd(cfg: RanchConfig): SimCow[] {
  const rnd = mulberry32(2026);
  const cows: SimCow[] = [];
  const { lat: cLat, lon: cLon } = cfg.herd_center;
  let guard = 0;
  while (cows.length < HERD_SIZE && guard++ < 5000) {
    // gaussian-ish cluster
    const r = HERD_RADIUS_M * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * 0.45;
    const a = rnd() * Math.PI * 2;
    const lat = cLat + (r * Math.cos(a)) / M_PER_DEG_LAT;
    const lon = cLon + (r * Math.sin(a)) / mPerDegLon(cLat);
    if (!pointInPolygon(lat, lon, cfg.boundary)) continue;
    const n = cows.length + 1;
    cows.push({
      id: `SIM-${String(n).padStart(3, "0")}`,
      name: `Cow ${100 + n}`,
      lat,
      lon,
      heading: rnd() * 360,
      flagged: false,
    });
  }
  return cows;
}

/**
 * Simulated herd: ~40 cows random-walking (grazing) inside the ranch polygon,
 * loosely clustered. Clearly labeled "Simulated" everywhere in the UI.
 */
export function useHerd(cfg: RanchConfig | null, enabled: boolean) {
  const [herd, setHerd] = useState<SimCow[]>([]);
  const ref = useRef<SimCow[]>([]);

  useEffect(() => {
    if (!cfg) return;
    ref.current = seedHerd(cfg);
    setHerd(ref.current);
  }, [cfg]);

  useEffect(() => {
    if (!cfg || !enabled) return;
    const rnd = Math.random;
    const id = window.setInterval(() => {
      const cows = ref.current;
      if (!cows.length) return;
      const cLat = cows.reduce((s, c) => s + c.lat, 0) / cows.length;
      const cLon = cows.reduce((s, c) => s + c.lon, 0) / cows.length;
      // the herd's centre itself drifts slowly toward the configured grazing area
      const homeLat = cfg.herd_center.lat;
      const homeLon = cfg.herd_center.lon;

      ref.current = cows.map((c) => {
        // many cows stand still (grazing) at any moment
        if (rnd() < 0.55) return c;
        let heading = c.heading + (rnd() - 0.5) * 50;
        const dHerd = distanceM(c.lat, c.lon, cLat, cLon);
        if (dHerd > HERD_RADIUS_M * 0.7) {
          const toward = bearingDeg(c.lat, c.lon, cLat, cLon);
          heading = heading + ((((toward - heading + 540) % 360) - 180) * 0.25);
        }
        if (distanceM(cLat, cLon, homeLat, homeLon) > 120) {
          const toward = bearingDeg(c.lat, c.lon, homeLat, homeLon);
          heading = heading + ((((toward - heading + 540) % 360) - 180) * 0.1);
        }
        const rad = (heading * Math.PI) / 180;
        const lat = c.lat + (STEP_M * Math.cos(rad)) / M_PER_DEG_LAT;
        const lon = c.lon + (STEP_M * Math.sin(rad)) / mPerDegLon(c.lat);
        if (!pointInPolygon(lat, lon, cfg.boundary)) return { ...c, heading: heading + 180 };
        return { ...c, lat, lon, heading };
      });
      setHerd(ref.current);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [cfg, enabled]);

  /** Outbreak scenario: flag 3 simulated cows (still labeled simulated). */
  const setOutbreak = (on: boolean) => {
    const pick = new Set(on ? ["SIM-007", "SIM-019", "SIM-031"] : []);
    ref.current = ref.current.map((c) => ({ ...c, flagged: pick.has(c.id) }));
    setHerd(ref.current);
  };

  return { herd, setOutbreak };
}
