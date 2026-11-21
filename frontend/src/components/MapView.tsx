import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Popup, Source } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent, MapRef, StyleSpecification } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Alert, LiveNode, RanchConfig, SimCow } from "../types";
import { IconRover } from "./Icons";

const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [ESRI_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    {
      id: "esri",
      type: "raster",
      source: "esri",
      paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.82, "raster-contrast": 0.05, "raster-fade-duration": 0 },
    },
  ],
};

export const ROVER_TRIP_S = 14;

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Props {
  config: RanchConfig;
  nodes: LiveNode[];
  alert: Alert | null;
  herd: SimCow[];
  showSim: boolean;
  dispatchedAt: number | null;
  clockOffset: number;
  padding: MapPadding;
  focusNonce: number;
}

export default function MapView({
  config,
  nodes,
  alert,
  herd,
  showSim,
  dispatchedAt,
  clockOffset,
  padding,
  focusNonce,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hover, setHover] = useState<{ lat: number; lon: number; name: string; flagged: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000 + clockOffset);

  const cow = nodes.find((n) => n.role === "cow");
  const base = nodes.find((n) => n.role === "base");
  const barn = base ? { lat: base.lat, lon: base.lon } : config.barn;
  const cowPos = alert ? { lat: alert.lat, lon: alert.lon } : cow ? { lat: cow.lat, lon: cow.lon } : config.tags.cow;

  /** Padding that always leaves room for the map, even on small screens. */
  const safePad = (extra: number) => {
    const el = mapRef.current?.getContainer();
    const w = el?.clientWidth ?? 1200;
    const h = el?.clientHeight ?? 800;
    let { top, bottom, left, right } = padding;
    const sx = Math.min(1, (w * 0.7) / Math.max(1, left + right + 2 * extra));
    const sy = Math.min(1, (h * 0.7) / Math.max(1, top + bottom + 2 * extra));
    left = (left + extra) * sx;
    right = (right + extra) * sx;
    top = (top + extra) * sy;
    bottom = (bottom + extra) * sy;
    return { top, bottom, left, right };
  };

  /* ---------- fit ranch on load ---------- */
  const fitRanch = (duration = 0) => {
    const map = mapRef.current;
    if (!map) return;
    const lats = config.boundary.map((p) => p[0]);
    const lons = config.boundary.map((p) => p[1]);
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); // flyTo padding persists; clear it so fits add up correctly
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: safePad(40), duration },
    );
  };

  /* ---------- fly to Cow1 on a new alert ---------- */
  const lastAlertId = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (alert && alert.id !== lastAlertId.current) {
      lastAlertId.current = alert.id;
      map.flyTo({ center: [alert.lon, alert.lat], zoom: 16.6, duration: 2600, essential: true, padding: safePad(0), curve: 1.3 });
    } else if (!alert && lastAlertId.current !== null) {
      lastAlertId.current = null;
      fitRanch(1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id]);

  /* ---------- frame barn + cow when the rover is dispatched ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dispatchedAt) return;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); // flyTo padding persists; clear it so fits add up correctly
    map.fitBounds(
      [
        [Math.min(barn.lon, cowPos.lon), Math.min(barn.lat, cowPos.lat)],
        [Math.max(barn.lon, cowPos.lon), Math.max(barn.lat, cowPos.lat)],
      ],
      { padding: safePad(70), duration: 1800, maxZoom: 17 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchedAt]);

  useEffect(() => {
    if (focusNonce > 0) fitRanch(1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  /* ---------- rover animation clock ---------- */
  useEffect(() => {
    if (!dispatchedAt) return;
    let raf = 0;
    const loop = () => {
      setNow(Date.now() / 1000 + clockOffset);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dispatchedAt, clockOffset]);

  const rover = useMemo(() => {
    if (!dispatchedAt) return null;
    const t = Math.min(1, Math.max(0, (now - dispatchedAt) / ROVER_TRIP_S));
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out
    const stop = 0.94; // park just short of the cow
    const k = eased * stop;
    return {
      lat: barn.lat + (cowPos.lat - barn.lat) * k,
      lon: barn.lon + (cowPos.lon - barn.lon) * k,
      arrived: t >= 1,
    };
  }, [dispatchedAt, now, barn.lat, barn.lon, cowPos.lat, cowPos.lon]);

  /* ---------- GeoJSON sources ---------- */
  const boundaryGeo = useMemo(() => {
    const ring = [...config.boundary, config.boundary[0]].map(([lat, lon]) => [lon, lat]);
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    };
  }, [config]);

  const herdGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: herd.map((c) => ({
        type: "Feature" as const,
        properties: { id: c.id, name: c.name, flagged: c.flagged ? 1 : 0 },
        geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
      })),
    }),
    [herd],
  );

  const routeGeo = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [barn.lon, barn.lat],
          [cowPos.lon, cowPos.lat],
        ],
      },
    }),
    [barn.lat, barn.lon, cowPos.lat, cowPos.lon],
  );

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f && f.geometry.type === "Point") {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      setHover({ lat, lon, name: String(f.properties?.name), flagged: f.properties?.flagged === 1 });
    } else if (hover) setHover(null);
  };

  return (
    <Map
      ref={mapRef}
      mapStyle={MAP_STYLE}
      initialViewState={{ latitude: config.map_center.lat, longitude: config.map_center.lon, zoom: config.zoom }}
      onLoad={(e) => {
        (window as unknown as { __bullhornMap: unknown }).__bullhornMap = e.target;
        fitRanch(0);
        // belt and braces: repaint once tiles settle (some browsers skip the first raster frame)
        e.target.once("idle", () => e.target.triggerRepaint());
        window.setTimeout(() => e.target.triggerRepaint(), 1500);
      }}
      onError={(e) => console.error("[map]", e.error?.message ?? e)}
      interactiveLayerIds={showSim ? ["herd"] : []}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={onMove}
      attributionControl={{ compact: true }}
      dragRotate={false}
      pitchWithRotate={false}
      maxZoom={19}
      style={{ position: "absolute", inset: 0 }}
      cursor={hover ? "pointer" : "grab"}
    >
      {/* Ranch boundary — thin, quiet outline */}
      <Source id="ranch" type="geojson" data={boundaryGeo}>
        <Layer id="ranch-fill" type="fill" paint={{ "fill-color": "#ffffff", "fill-opacity": 0.04 }} />
        <Layer
          id="ranch-line"
          type="line"
          paint={{ "line-color": "#ffffff", "line-opacity": 0.85, "line-width": 1.5 }}
          layout={{ "line-join": "round" }}
        />
      </Source>

      {/* Rover route (visualization) */}
      {dispatchedAt && (
        <Source id="route" type="geojson" data={routeGeo}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#ffffff", "line-opacity": 0.7, "line-width": 1.5, "line-dasharray": [2, 2] }}
          />
        </Source>
      )}

      {/* Simulated herd — muted dots, clearly secondary to live tags */}
      {showSim && (
        <Source id="herd" type="geojson" data={herdGeo}>
          <Layer
            id="herd"
            type="circle"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2, 16, 3.6, 18, 6],
              "circle-color": ["case", ["==", ["get", "flagged"], 1], "#ff9f0a", "#e8e8ed"],
              "circle-opacity": ["case", ["==", ["get", "flagged"], 1], 0.95, 0.72],
              "circle-stroke-color": "rgba(0,0,0,0.45)",
              "circle-stroke-width": 1,
            }}
          />
        </Source>
      )}

      {hover && showSim && (
        <Popup latitude={hover.lat} longitude={hover.lon} closeButton={false} offset={12} anchor="bottom">
          <div className="glass-strong rounded-xl px-3 py-2 text-[12px] leading-tight text-ink">
            <div className="font-semibold">{hover.name}</div>
            <div className="text-mute">Simulated{hover.flagged ? " · flagged (scenario)" : ""}</div>
          </div>
        </Popup>
      )}

      {/* Barn Station (Base tag) */}
      <Marker latitude={barn.lat} longitude={barn.lon} anchor="center">
        <div className="relative flex flex-col items-center">
          <div className="relative grid h-5 w-5 place-items-center">
            <span className="pulse-ring bg-white/40" />
            <div className="relative h-5 w-5 rounded-[6px] border-2 border-white bg-[#1d1d1f] shadow-lg">
              <div className="absolute inset-[4px] rounded-[2px] bg-white" />
            </div>
          </div>
          <MarkerLabel title="Barn Station" subtitle="LIVE · LoRa" />
        </div>
      </Marker>

      {/* Rover (visualization only) */}
      {rover && (
        <Marker latitude={rover.lat} longitude={rover.lon} anchor="center">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-black shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            <IconRover size={18} />
          </div>
        </Marker>
      )}

      {/* Cow1 (live tag) */}
      <Marker latitude={cowPos.lat} longitude={cowPos.lon} anchor="center">
        <div className="relative flex flex-col items-center">
          <div className="relative h-4 w-4">
            {alert ? (
              <>
                <span className="alert-ring" />
                <span className="alert-ring delay" />
              </>
            ) : (
              <span className="pulse-ring bg-link/50" />
            )}
            <div
              className={`relative h-4 w-4 rounded-full border-2 border-white shadow-lg transition-colors duration-500 ${
                alert ? "bg-alert" : "bg-link"
              }`}
            />
          </div>
          <MarkerLabel title="Cow1" subtitle={alert ? "Alert" : "LIVE · LoRa"} alert={!!alert} />
        </div>
      </Marker>
    </Map>
  );
}

function MarkerLabel({ title, subtitle, alert }: { title: string; subtitle: string; alert?: boolean }) {
  return (
    <div className="pointer-events-none absolute top-6 whitespace-nowrap rounded-full bg-black/65 px-2.5 py-1 text-[11px] leading-none backdrop-blur-md">
      <span className="font-semibold text-white">{title}</span>
      <span className={`ml-1.5 ${alert ? "text-alert" : "text-white/60"}`}>{subtitle}</span>
    </div>
  );
}
