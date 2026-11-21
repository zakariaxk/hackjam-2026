"""
Bullhorn — backend
Early warning for New World screwworm, built for the open range.

One FastAPI app that:
  * reads the Base tag (Meshtastic T1000-E) over USB serial
  * flags Cow1 when any packet arrives from its tag (LoRa mesh, no internet)
  * sends a bell text to Cow1 so its buzzer beeps ("Locate")
  * coordinates the rover phone camera (/cam) and sends the photo to Gemini
  * serves the built React dashboard (frontend/dist) at /

Run:  uvicorn server:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

# ---------------------------------------------------------------------------
# CONFIG — edit these
# ---------------------------------------------------------------------------

# Node IDs from `meshtastic --info` (look like "!a1b2c3d4").
# If left as placeholders, the server auto-detects:
#   COW_ID  -> any node whose name is COW_NAME ("Cow1")
#   BASE_ID -> the tag that is plugged into this laptop
COW_ID = "!COW_ID"
BASE_ID = "!BASE_ID"
COW_NAME = "Cow1"

# Optional: force a serial port, e.g. "/dev/cu.usbmodem1101" or "COM5".
MESH_PORT = os.environ.get("MESH_PORT") or None

ALERT_DEBOUNCE_S = 10        # ignore repeat Cow1 packets within this window
STARTUP_GRACE_S = 12         # ignore Cow1 packets right after the radio connects (node DB sync chatter)
PING_GRACE_S = 6             # ignore Cow1 packets right after we ping it (its reply is not an alert)

# Demo ranch: open pasture in eastern Hillsborough County, FL (near Picnic / Keysville).
# Verified on Esri World Imagery: open grazing land with ponds, no houses inside. ~271 acres.
RANCH: dict[str, Any] = {
    "name": "Picnic Creek Ranch (demo)",
    "county": "Hillsborough County, FL",
    "acres": 271,
    # [lat, lon] ring (not closed; the frontend closes it)
    "boundary": [
        [27.830333, -82.166193],
        [27.830717, -82.160227],
        [27.830333, -82.153977],
        [27.821951, -82.153920],
        [27.821849, -82.161648],
        [27.822667, -82.165341],
    ],
    "barn": {"name": "Barn Station", "lat": 27.822667, "lon": -82.155398},
    # Fixed coordinates we program into each tag with `meshtastic --setlat/--setlon`.
    # Also used as the fallback if a live position is missing or outside the ranch.
    "tags": {
        "cow": {"name": "Cow1", "lat": 27.827267, "lon": -82.162216},
        "base": {"name": "Barn Station", "lat": 27.822667, "lon": -82.155398},
    },
    # Where the simulated herd grazes (frontend random-walks ~40 cows around here)
    "herd_center": {"lat": 27.826244, "lon": -82.159659},
    "map_center": {"lat": 27.82625, "lon": -82.16005},
    "zoom": 15.6,
}

GEMINI_MODELS = [
    m
    for m in [
        os.environ.get("GEMINI_MODEL"),
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash",
    ]
    if m
]

GEMINI_PROMPT = """You are a livestock health triage assistant supporting Florida ranchers during the 2026 New World screwworm (Cochliomyia hominivorax) outbreak. You are looking at a photo taken by a ranch rover camera of an animal flagged for abnormal behavior (head shaking, isolation, irritation).

Assess the visible skin/wound area and return ONLY this JSON:
{
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "confidence": 0-100,
  "findings": "1-2 sentences describing what is visible (open wound, larvae/maggot-like objects, blood, discharge, swelling, fly activity, or nothing abnormal)",
  "recommended_action": "1 sentence: e.g. isolate animal, contact veterinarian, collect larvae sample, continue monitoring",
  "fdacs_report": "A 3-4 sentence draft report to the Florida Department of Agriculture and Consumer Services (FDACS) Division of Animal Industry describing the suspected case, animal ID 'Cow1', and observed signs, written for a veterinarian to confirm."
}

Rules: Open wounds with larvae or maggot-like objects = HIGH. Open wounds without larvae = MEDIUM. No visible wound = LOW. This is triage only, never a diagnosis. If the image is unclear, say so and set confidence low."""

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "frontend" / "dist"
CAPTURE_DIR = BASE_DIR / "captures"
CAPTURE_DIR.mkdir(exist_ok=True)
LAST_JPG = CAPTURE_DIR / "last.jpg"

# ---------------------------------------------------------------------------
# STATE
# ---------------------------------------------------------------------------

lock = threading.RLock()


def _fresh_flow() -> dict[str, Any]:
    return {"located_at": None, "dispatched_at": None, "scan_requested_at": None, "scanned_at": None}


state: dict[str, Any] = {
    "radio_online": False,
    "radio_port": None,
    "nodes": {},            # id -> node dict
    "alert": None,
    "alert_log": [],
    "scan_pending": False,
    "analyzing": False,
    "result": None,
    "has_image": False,
    "image_version": 0,
    "last_error": None,
    "flow": _fresh_flow(),
}

radio: Any = None
radio_connected_at = 0.0
last_alert_at = 0.0
last_ping_at = 0.0
resolved_cow_id: Optional[str] = None
resolved_base_id: Optional[str] = None


def set_error(msg: Optional[str]) -> None:
    with lock:
        state["last_error"] = msg
    if msg:
        print(f"[error] {msg}")


def is_placeholder(node_id: Optional[str]) -> bool:
    return not node_id or "COW_ID" in node_id or "BASE_ID" in node_id


# ---------------------------------------------------------------------------
# GEOMETRY
# ---------------------------------------------------------------------------


def in_ranch(lat: Optional[float], lon: Optional[float]) -> bool:
    """Ray-casting point-in-polygon on the ranch boundary."""
    if lat is None or lon is None:
        return False
    poly = RANCH["boundary"]
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


# ---------------------------------------------------------------------------
# MESHTASTIC
# ---------------------------------------------------------------------------


def cow_id() -> Optional[str]:
    return COW_ID if not is_placeholder(COW_ID) else resolved_cow_id


def base_id() -> Optional[str]:
    return BASE_ID if not is_placeholder(BASE_ID) else resolved_base_id


def role_of(node_id: str) -> Optional[str]:
    if node_id and node_id == cow_id():
        return "cow"
    if node_id and node_id == base_id():
        return "base"
    return None


def upsert_node(node_id: str, name: Optional[str] = None, lat: Optional[float] = None,
                lon: Optional[float] = None, last_heard: Optional[float] = None,
                battery: Optional[int] = None) -> None:
    global resolved_cow_id
    if not node_id:
        return
    # Auto-detect Cow1 by name if COW_ID wasn't filled in.
    if is_placeholder(COW_ID) and name and name.strip().lower() == COW_NAME.lower():
        if resolved_cow_id != node_id:
            resolved_cow_id = node_id
            print(f"[mesh] auto-detected {COW_NAME} = {node_id} (paste into COW_ID to lock it)")
    with lock:
        n = state["nodes"].setdefault(node_id, {"id": node_id})
        if name:
            n["reported_name"] = name
        if lat is not None and lon is not None and not (lat == 0 and lon == 0):
            n["reported_lat"], n["reported_lon"] = lat, lon
        if last_heard:
            n["last_heard"] = max(n.get("last_heard") or 0, last_heard)
        if battery is not None:
            n["battery"] = battery


def node_view(n: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Return the public view of a live node (only Cow1 + Base are shown)."""
    role = role_of(n["id"])
    if role is None:
        return None
    fallback = RANCH["tags"][role]
    lat, lon = n.get("reported_lat"), n.get("reported_lon")
    source = "radio"
    if not in_ranch(lat, lon):
        # Missing, or blurred by Meshtastic channel position precision -> use configured spot.
        lat, lon, source = fallback["lat"], fallback["lon"], "config"
    return {
        "id": n["id"],
        "role": role,
        "name": fallback["name"],
        "reported_name": n.get("reported_name"),
        "lat": lat,
        "lon": lon,
        "position_source": source,
        "last_heard": n.get("last_heard"),
        "battery": n.get("battery"),
    }


def _node_from_db(node_id: str, info: dict[str, Any]) -> None:
    user = info.get("user") or {}
    pos = info.get("position") or {}
    metrics = info.get("deviceMetrics") or {}
    upsert_node(
        node_id,
        name=user.get("longName") or user.get("shortName"),
        lat=pos.get("latitude"),
        lon=pos.get("longitude"),
        last_heard=info.get("lastHeard"),
        battery=metrics.get("batteryLevel"),
    )


def sync_node_db() -> None:
    if radio is None or not getattr(radio, "nodes", None):
        return
    try:
        for node_id, info in list(radio.nodes.items()):
            _node_from_db(node_id, info)
    except Exception as e:  # noqa: BLE001
        print(f"[mesh] node db sync failed: {e}")


def raise_alert(source: str, node_id: Optional[str], portnum: Optional[str] = None) -> None:
    global last_alert_at
    now = time.time()
    with lock:
        cow = node_view(state["nodes"].get(node_id or "", {"id": node_id})) if node_id else None
        tag = RANCH["tags"]["cow"]
        alert = {
            "id": int(now * 1000),
            "node_id": node_id,
            "name": COW_NAME,
            "behavior": "abnormal behavior",
            "time": now,
            "source": source,          # "lora" | "manual"
            "via": "LoRa mesh" if source == "lora" else "Manual backup trigger",
            "portnum": portnum,
            "lat": cow["lat"] if cow else tag["lat"],
            "lon": cow["lon"] if cow else tag["lon"],
        }
        state["alert"] = alert
        state["alert_log"].insert(0, alert)
        del state["alert_log"][25:]
        state["flow"] = _fresh_flow()
        state["result"] = None
        state["has_image"] = False
        state["scan_pending"] = False
        last_alert_at = now
    print(f"[ALERT] {COW_NAME} abnormal behavior via {alert['via']} at {time.strftime('%H:%M:%S')}")


def on_receive(packet: dict, interface: Any = None) -> None:  # pubsub callback
    try:
        from_id = packet.get("fromId") or (
            f"!{packet['from']:08x}" if isinstance(packet.get("from"), int) else None
        )
        decoded = packet.get("decoded") or {}
        portnum = decoded.get("portnum")
        pos = decoded.get("position") or {}
        lat, lon = pos.get("latitude"), pos.get("longitude")
        user = decoded.get("user") or {}
        telem = (decoded.get("telemetry") or {}).get("deviceMetrics") or {}
        print(f"[mesh] packet from={from_id} port={portnum} lat={lat} lon={lon}")

        if not from_id:
            return
        # Pull richer info (name/position/battery) from the node DB as well.
        db = (getattr(radio, "nodes", None) or {}).get(from_id)
        if db:
            _node_from_db(from_id, db)
        upsert_node(
            from_id,
            name=user.get("longName"),
            lat=lat,
            lon=lon,
            last_heard=time.time(),
            battery=telem.get("batteryLevel"),
        )

        if from_id == cow_id() and portnum != "ROUTING_APP":
            now = time.time()
            with lock:
                active = state["alert"] is not None
            if now - radio_connected_at < STARTUP_GRACE_S:
                print("[mesh] Cow1 packet ignored (startup grace period)")
            elif now - last_ping_at < PING_GRACE_S:
                print("[mesh] Cow1 packet ignored (reply to our ping)")
            elif active or now - last_alert_at < ALERT_DEBOUNCE_S:
                print("[mesh] Cow1 packet debounced (alert already active)")
            else:
                raise_alert("lora", from_id, portnum)
    except Exception as e:  # noqa: BLE001
        set_error(f"Packet handling failed: {e}")
        traceback.print_exc()


def on_connection_lost(interface: Any = None) -> None:
    global radio
    print("[mesh] connection lost")
    with lock:
        state["radio_online"] = False
    radio = None


def radio_thread() -> None:
    """Keep trying to connect to the Base tag. Server works without it."""
    global radio, radio_connected_at, resolved_base_id
    try:
        from pubsub import pub
        import meshtastic.serial_interface
        import meshtastic.util
    except Exception as e:  # noqa: BLE001
        print(f"[mesh] meshtastic library not available ({e}); radio disabled")
        return

    pub.subscribe(on_receive, "meshtastic.receive")
    pub.subscribe(on_connection_lost, "meshtastic.connection.lost")
    announced_missing = False

    while True:
        if radio is None:
            try:
                ports = [MESH_PORT] if MESH_PORT else meshtastic.util.findPorts(True)
                if not ports:
                    if not announced_missing:
                        print("[mesh] no Base tag found on USB — running without radio (will keep checking)")
                        announced_missing = True
                else:
                    port = ports[0]
                    print(f"[mesh] connecting to Base tag on {port} ...")
                    iface = meshtastic.serial_interface.SerialInterface(devPath=port)
                    radio = iface
                    radio_connected_at = time.time()
                    announced_missing = False
                    try:
                        me = iface.getMyNodeInfo() or {}
                        my_id = (me.get("user") or {}).get("id")
                        if my_id:
                            resolved_base_id = my_id
                            if not is_placeholder(BASE_ID) and BASE_ID != my_id:
                                print(f"[mesh] note: plugged-in tag is {my_id}, BASE_ID is {BASE_ID}")
                    except Exception:  # noqa: BLE001
                        pass
                    sync_node_db()
                    with lock:
                        state["radio_online"] = True
                        state["radio_port"] = port
                    print(f"[mesh] online. base={base_id()} cow={cow_id() or '(waiting for ' + COW_NAME + ')'}")
            except BaseException as e:  # noqa: BLE001  (library may call sys.exit)
                if isinstance(e, KeyboardInterrupt):
                    raise
                radio = None
                with lock:
                    state["radio_online"] = False
                print(f"[mesh] connect failed: {e!r} (port busy? close the meshtastic CLI). Retrying in 5 s")
        else:
            sync_node_db()
        time.sleep(5)


# ---------------------------------------------------------------------------
# GEMINI
# ---------------------------------------------------------------------------


def parse_result(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    try:
        data = json.loads(match.group(0) if match else cleaned)
    except Exception:  # noqa: BLE001
        return {"parsed": False, "raw": text}
    risk = str(data.get("risk", "")).upper().strip()
    if risk not in ("LOW", "MEDIUM", "HIGH"):
        risk = "MEDIUM" if "MED" in risk else ("HIGH" if "HIGH" in risk else "LOW")
    try:
        confidence = max(0, min(100, int(float(data.get("confidence", 0)))))
    except Exception:  # noqa: BLE001
        confidence = 0
    return {
        "parsed": True,
        "risk": risk,
        "confidence": confidence,
        "findings": str(data.get("findings", "")),
        "recommended_action": str(data.get("recommended_action", "")),
        "fdacs_report": str(data.get("fdacs_report", "")),
        "raw": text,
    }


FAKE_RESULT = {
    "risk": "HIGH",
    "confidence": 82,
    "findings": "UI TEST ONLY (BULLHORN_FAKE_GEMINI=1): open red lesion with several small white larva-like objects visible.",
    "recommended_action": "Isolate the animal, contact a veterinarian, and collect a larvae sample.",
    "fdacs_report": "UI TEST ONLY. This is a canned response used to rehearse the dashboard without calling Gemini.",
}


def call_gemini(image: bytes) -> dict[str, Any]:
    if os.environ.get("BULLHORN_FAKE_GEMINI") == "1":
        time.sleep(2.5)  # rehearsal mode: canned result, clearly labeled, no API call
        result = parse_result(json.dumps(FAKE_RESULT))
        result["model"] = "canned test response (BULLHORN_FAKE_GEMINI=1)"
        return result
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set. Export it, then restart the server.")
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    last_exc: Optional[Exception] = None
    for model in GEMINI_MODELS:
        try:
            t0 = time.time()
            resp = client.models.generate_content(
                model=model,
                contents=[types.Part.from_bytes(data=image, mime_type="image/jpeg"), GEMINI_PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            text = resp.text or ""
            print(f"[gemini] {model} answered in {time.time() - t0:.1f}s")
            result = parse_result(text)
            result["model"] = model
            return result
        except Exception as e:  # noqa: BLE001
            last_exc = e
            print(f"[gemini] {model} failed: {e}")
            msg = str(e).lower()
            if "api key" in msg or "permission" in msg or "api_key" in msg:
                break  # key problem: other models won't help
    raise RuntimeError(f"Gemini request failed: {last_exc}")


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

app = FastAPI(title="Bullhorn")


@app.on_event("startup")
def _startup() -> None:
    threading.Thread(target=radio_thread, daemon=True).start()
    if LAST_JPG.exists():
        LAST_JPG.unlink()
    key = "set" if os.environ.get("GEMINI_API_KEY") else "MISSING"
    dist = "found" if (DIST_DIR / "index.html").exists() else "MISSING (run npm run build in frontend/)"
    print(f"[bullhorn] GEMINI_API_KEY {key} · frontend/dist {dist}")


@app.get("/api/status")
def api_status() -> dict[str, Any]:
    with lock:
        nodes = [v for v in (node_view(n) for n in state["nodes"].values()) if v]
        roles_present = {n["role"] for n in nodes}
        # Always show both live tags at their configured spots, even before first contact.
        for role in ("base", "cow"):
            if role not in roles_present:
                tag = RANCH["tags"][role]
                nodes.append({
                    "id": (base_id() if role == "base" else cow_id()) or None,
                    "role": role, "name": tag["name"], "reported_name": None,
                    "lat": tag["lat"], "lon": tag["lon"], "position_source": "config",
                    "last_heard": None, "battery": None,
                })
        nodes.sort(key=lambda n: 0 if n["role"] == "cow" else 1)
        return {
            "radio_online": state["radio_online"],
            "radio_port": state["radio_port"],
            "cow_id": cow_id(),
            "base_id": base_id(),
            "nodes": nodes,
            "alert": state["alert"],
            "alert_log": state["alert_log"],
            "scan_pending": state["scan_pending"],
            "analyzing": state["analyzing"],
            "result": state["result"],
            "has_image": state["has_image"],
            "image_version": state["image_version"],
            "last_error": state["last_error"],
            "flow": state["flow"],
            "gemini_key": bool(os.environ.get("GEMINI_API_KEY")),
            "server_time": time.time(),
        }


@app.get("/api/config")
def api_config() -> dict[str, Any]:
    return RANCH


@app.post("/api/request-scan")
def api_request_scan() -> dict[str, Any]:
    with lock:
        state["scan_pending"] = True
        state["result"] = None
        state["flow"]["scan_requested_at"] = time.time()
        state["last_error"] = None
    return {"ok": True}


@app.get("/api/should-scan")
def api_should_scan() -> dict[str, bool]:
    with lock:
        pending = state["scan_pending"]
        state["scan_pending"] = False
    return {"scan": pending}


@app.post("/api/analyze")
def api_analyze(file: UploadFile = File(...)) -> JSONResponse:
    try:
        data = file.file.read()
        if not data:
            raise RuntimeError("Empty image upload")
        LAST_JPG.write_bytes(data)
        with lock:
            state["has_image"] = True
            state["image_version"] += 1
            state["analyzing"] = True
            state["scan_pending"] = False
            state["result"] = None
            state["last_error"] = None
            state["flow"]["scanned_at"] = time.time()
        print(f"[cam] received {len(data) // 1024} KB, asking Gemini ...")
    except Exception as e:  # noqa: BLE001
        set_error(f"Upload failed: {e}")
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    try:
        result = call_gemini(data)
        with lock:
            state["result"] = result
        print(f"[gemini] risk={result.get('risk')} confidence={result.get('confidence')}")
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        set_error(str(e))
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)
    finally:
        with lock:
            state["analyzing"] = False


@app.get("/api/last.jpg")
def api_last_jpg() -> Response:
    if not LAST_JPG.exists():
        return Response(status_code=404)
    return FileResponse(LAST_JPG, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@app.post("/api/ping-cow")
def api_ping_cow() -> JSONResponse:
    global last_ping_at
    target = cow_id()
    if radio is None or not state["radio_online"]:
        set_error("Base tag is offline — plug it in to beep Cow1.")
        return JSONResponse({"ok": False, "error": "radio offline"}, status_code=503)
    if not target:
        set_error(f"Cow1 node ID unknown. Set COW_ID in server.py or press the {COW_NAME} tag once.")
        return JSONResponse({"ok": False, "error": "cow id unknown"}, status_code=400)
    try:
        last_ping_at = time.time()
        radio.sendText("\aFIND ME", destinationId=target)
        with lock:
            state["flow"]["located_at"] = time.time()
            state["last_error"] = None
        print(f"[mesh] beep sent to {target}")
        return JSONResponse({"ok": True})
    except Exception as e:  # noqa: BLE001
        set_error(f"Could not send beep: {e}")
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/api/dispatch")
def api_dispatch() -> dict[str, Any]:
    with lock:
        state["flow"]["dispatched_at"] = time.time()
    print("[rover] dispatch (press the Uno reset button now)")
    return {"ok": True}


@app.post("/api/simulate-alert")
def api_simulate_alert() -> dict[str, Any]:
    raise_alert("manual", cow_id())
    return {"ok": True}


@app.post("/api/clear-error")
def api_clear_error() -> dict[str, Any]:
    set_error(None)
    return {"ok": True}


@app.post("/api/reset")
def api_reset() -> dict[str, Any]:
    global last_alert_at
    with lock:
        state["alert"] = None
        state["scan_pending"] = False
        state["analyzing"] = False
        state["result"] = None
        state["has_image"] = False
        state["last_error"] = None
        state["flow"] = _fresh_flow()
        last_alert_at = 0.0
    if LAST_JPG.exists():
        LAST_JPG.unlink()
    print("[bullhorn] reset")
    return {"ok": True}


# ---------------------------------------------------------------------------
# FRONTEND (SPA) — must be registered last
# ---------------------------------------------------------------------------

NO_BUILD_HTML = """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font:17px -apple-system,BlinkMacSystemFont,sans-serif;background:#000;color:#f5f5f7;
display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:520px;padding:24px">
<h1 style="font-weight:600;letter-spacing:-.005em">Bullhorn</h1>
<p style="color:#a1a1a6">The API is running, but the dashboard hasn't been built yet.</p>
<pre style="background:#1d1d1f;padding:16px;border-radius:12px">cd frontend
npm install
npm run build</pre></div>"""


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str) -> Response:
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if not (DIST_DIR / "index.html").exists():
        return HTMLResponse(NO_BUILD_HTML)
    candidate = (DIST_DIR / full_path).resolve()
    if full_path and candidate.is_file() and DIST_DIR.resolve() in candidate.parents:
        headers = {"Cache-Control": "public, max-age=31536000, immutable"} if "/assets/" in str(candidate) else {}
        return FileResponse(candidate, headers=headers)
    return FileResponse(DIST_DIR / "index.html", headers={"Cache-Control": "no-store"})
