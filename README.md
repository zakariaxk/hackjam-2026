# Bullhorn

**Early warning for New World screwworm, built for the open range.**

Bullhorn sounds the alarm the moment a cow shows signs of screwworm. Every cow wears a cheap LoRa mesh tag. When a tag catches irritated behavior, the ranch dashboard flags that cow on a live satellite map. The rancher beeps the tag to find it, sends a camera rover, and Gemini returns a screwworm risk triage plus a draft report for the Florida Department of Agriculture and Consumer Services (FDACS). No cell signal needed in the pasture.

> Triage only, never a diagnosis. A veterinarian confirms every suspected case.

Built at **HackJam '26 (USF SHPE)**. Tracks: Best Overall, Home Turf, Off the Grid, Gemini API challenge.

---

## The problem (2026)

- **New World screwworm** (*Cochliomyia hominivorax*) is a fly whose larvae eat living flesh, entering through any open wound.
- The **first U.S. domestic-animal case** of the current outbreak was confirmed in **Texas cattle in June 2026**, and it has been spreading in Texas.
- **Florida** has no confirmed case yet but is running emergency animal-import rules. Florida was ground zero of the last U.S. outbreak (Florida Keys deer, 2016–17).
- Florida has about **1.58 million cattle** and ranks **9th in the U.S. in beef cows**.
- Early detection depends on **inspecting every animal for wounds**. That does not scale across huge pastures with no cell signal. Early signs are behavioral: irritation, head shaking, biting at a wound.

## How it works

```
   PASTURE (no internet)                      BARN / LAPTOP                         ANYWHERE (HTTPS)
 ┌──────────────────────┐   LoRa mesh   ┌──────────────────────────┐   cloudflared   ┌───────────────────────┐
 │ Cow1 tag (T1000-E)   │ ────────────▶ │ Base tag (T1000-E)       │                 │ Dashboard (laptop /   │
 │ button x2 = "head    │ ◀──────────── │   │ USB serial            │                 │ iPhone): live map,    │
 │ shaking" detected    │  "\aFIND ME"  │   ▼                       │   quick tunnel  │ alert, rover, triage  │
 │ buzzer = locate beep │    (beep)     │ server.py (FastAPI)       │ ◀─────────────▶ │                       │
 └──────────────────────┘               │  • meshtastic + pubsub   │                 ├───────────────────────┤
                                        │  • /api/* + React SPA    │                 │ Rover iPhone (/cam)   │
 ┌──────────────────────┐               │  • google-genai ─────────┼──▶ Gemini Flash │ polls should-scan,    │
 │ Rover (Arduino UNO)  │               └──────────────────────────┘    (triage +    │ uploads JPEG          │
 │ hardcoded route,     │                                                FDACS draft)└───────────────────────┘
 │ runs on reset press  │  ◀── iPhone taped on top = the rover's camera
 └──────────────────────┘
```

**Demo flow:** shake the cardboard cow (the Cow1 tag's accelerometer detects head shaking and broadcasts an alert over LoRa; the Base tag beeps) → Cow1 turns red, map flies to it, alert card slides in → **Locate** (tag beeps over LoRa) → **Dispatch rover** (map animation + press the Uno's reset so the real rover drives to the cow) → **Scan wound** (rover phone captures, Gemini triages) → result sheet with risk, confidence, findings, action and a copyable FDACS draft → **Reset**.

### Honesty notes (we say these out loud to judges)

- **The ~40-cow herd is simulated.** It's a client-side grazing model, labeled "Simulated" in the legend, the herd panel and on hover, with a toggle to hide it. The optional outbreak scenario only flags simulated cows.
- **The rover dispatch animation on the map is a visualization.** The real rover has no GPS or sensors. It drives a hardcoded route each time its reset button is pressed.
- **Tag positions are fixed for indoor demo use** because GPS doesn't work indoors. We program each tag's position with `meshtastic --setlat/--setlon`, and the tags broadcast it over LoRa. If a reported position is missing or falls outside the ranch, the server uses the configured coordinates.
- **Head-shake detection is real on-tag code.** We patched the Meshtastic firmware on the Cow1 tag (`firmware/`) so its QMA6100P accelerometer counts sharp jolts and broadcasts an alert when it sees a head-shake pattern (5 jolts in 2 s). A cardboard cow stands in for the cow. A double press of the tag button still works as a backup trigger and is labeled "tag button" on screen.
- **Manual backup alerts** (menu → "Simulate alert (backup)") are labeled **MANUAL TRIGGER** on screen. We tell judges if we use it.
- The demo ranch boundary is a real ~271-acre open pasture in eastern Hillsborough County, FL (near Picnic), picked from satellite imagery. It is not a real customer ranch.

## Hardware

| Part | Role |
|---|---|
| 2× SenseCAP Card Tracker **T1000-E** (Meshtastic firmware) | **Cow1** tag (taped to a cardboard cow) and **Base** tag / "Barn Station" (USB to laptop). Direct LoRa mesh, no gateway. |
| **OSOYOO FlexiRover** chassis, 4× TT gear motors, **OSOYOO Model X** motor driver | Rover |
| **Arduino UNO R3** clone (ATmega328P) | Runs the rover route (`rover/rover.ino`) |
| 18650 battery box | Powers driver + Uno (barrel jack) |
| **iPhone** | Rover camera (`/cam`) and/or dashboard |
| Laptop | Runs `server.py`, serves the dashboard, hosts the Base tag |

## Repo layout

```
server.py              FastAPI backend (radio, API, Gemini, serves the built frontend)
requirements.txt       Python deps
frontend/              Vite + React + TypeScript + Tailwind + Framer Motion + MapLibre
  src/components/      Dashboard, MapView, FlowPanel, HerdPanel, ResultSheet, CamPage …
rover/rover.ino        Arduino route sketch
firmware/              Cow1 tag firmware patch: accelerometer head-shake detection (+ build/flash steps)
scripts/setup-cow-tag.sh  One-command meshtastic CLI setup for the Cow1 tag
PRD.md                 One-page product requirements
.claude/skills/apple-ui/SKILL.md   Design skill the UI follows
v2smartcar-lesson1/    OSOYOO's Lesson 1 sample sketch (vendor code, used to confirm wiring)
```

---

## Setup (macOS)

Run each block in **Terminal**. Everything happens inside this repo folder.

### A. Install

1. Get the code (skip if you already have it):
   ```bash
   git clone https://github.com/zakariaxk/hackjam-2026.git && cd hackjam-2026
   ```
2. Python packages, in a virtual environment (Homebrew Python blocks global `pip install`):
   ```bash
   python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
   ```
   Every new Terminal window: run `source .venv/bin/activate` first (this also gives you the `meshtastic` command).
3. Node (skip if `node -v` prints v20 or newer): `brew install node`
4. Build the dashboard:
   ```bash
   cd frontend && npm install && npm run build && cd ..
   ```

### B. Configure the two tags (meshtastic CLI over USB, one tag at a time)

Stop the server first (Ctrl+C). Only one program can use the tag's USB port at a time.

1. **Tag 1 → Cow1.** Plug it in with the magnetic USB cable (it must snap on fully). Press its button once to power on. Set the radio region. It won't transmit without this. The tag reboots, so wait about 15 seconds after:
   ```bash
   meshtastic --set lora.region US
   ```
2. Name it, give it its fixed spot inside the demo ranch, and turn on the beep for bell messages:
   ```bash
   meshtastic --set-owner "Cow1" --set-owner-short "COW1"
   ```
   ```bash
   meshtastic --setlat 27.827267 --setlon -82.162216
   ```
   ```bash
   meshtastic --set external_notification.enabled true --set external_notification.alert_bell true --set external_notification.alert_bell_buzzer true --set external_notification.alert_message_buzzer true --set external_notification.use_pwm true
   ```
   Optional. These send exact positions (instead of rounded ones) and make the tag's automatic broadcasts rare, so only your double press triggers alerts:
   ```bash
   meshtastic --ch-index 0 --ch-set module_settings.position_precision 32
   ```
   ```bash
   meshtastic --set position.position_broadcast_secs 3600 --set position.position_broadcast_smart_enabled false --set telemetry.device_update_interval 3600
   ```
3. Get its node ID:
   ```bash
   meshtastic --info
   ```
   Find `"id": "!xxxxxxxx"` under "Owner"/"My info". Paste it into `COW_ID` near the top of `server.py`. If you skip this, the server finds the node named "Cow1" by itself. Unplug the tag.
4. **Tag 2 → Base ("Barn Station").** Plug it in and power it on, then set the region and wait about 15 seconds:
   ```bash
   meshtastic --set lora.region US
   ```
   ```bash
   meshtastic --set-owner "Base" --set-owner-short "BASE"
   ```
   ```bash
   meshtastic --setlat 27.822667 --setlon -82.155398
   ```
   ```bash
   meshtastic --info
   ```
   Paste its `!xxxxxxxx` into `BASE_ID`. The server also detects the plugged-in tag automatically. **Leave this tag plugged in.**
5. **Test the link.** Double-press the Cow1 tag's button, wait about 10 seconds, then:
   ```bash
   meshtastic --nodes
   ```
   Cow1 should be listed with its position. Test the beep (replace the ID):
   ```bash
   meshtastic --dest '!a1b2c3d4' --sendtext $'\aFIND ME'
   ```
6. **Troubleshooting**
   - "No Serial Meshtastic device detected": try another USB cable (some only charge). Make sure the magnetic connector is fully snapped on and the tag is powered on.
   - "Resource busy" / port in use: stop `uvicorn` and close any other `meshtastic` command.
   - Multiple ports found: add `--port /dev/cu.usbmodemXXXX` (list them with `ls /dev/cu.usbmodem*`). For the server: `export MESH_PORT=/dev/cu.usbmodemXXXX`.
   - If `--setlat` is rejected by your CLI version, run `meshtastic --help | grep -i lat` and use the fixed-position equivalent.
   - No beep: run `meshtastic --get external_notification` on Cow1 and check that `enabled`, `alert_bell_buzzer` and `use_pwm` are true.

### C. Run

1. Get a Gemini API key at **aistudio.google.com** (Get API key). Put it in a file named `.env` in the repo root (it's gitignored, never commit it):
   ```bash
   echo 'GEMINI_API_KEY=paste-your-key-here' > .env
   ```
   `server.py` loads `.env` on start. An exported `GEMINI_API_KEY` environment variable also works (Windows PowerShell: `$env:GEMINI_API_KEY="..."`).
2. Start the server (with `.venv` activated):
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
   You should see `[mesh] online. base=!… cow=!…`. With no tag plugged in it still runs, showing "LoRa mesh · Offline", and the camera + Gemini still work.
3. HTTPS tunnel (Safari needs HTTPS for the camera). In a **second** Terminal:
   ```bash
   brew install cloudflared
   ```
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
   Copy the `https://….trycloudflare.com` link it prints. It changes every time you restart cloudflared.
4. Open it:
   - Laptop and/or phone dashboard: `https://<link>`
   - Rover iPhone: `https://<link>/cam` → tap **Start camera** → Allow. In Settings › Display & Brightness, set **Auto-Lock to Never**.
5. **Test camera + Gemini before touching the rover.** Make a fake wound on the cow box with a red marker blotch and a few grains of white rice. Point the rover phone at it, click **Scan wound** on the dashboard, and confirm the result says **HIGH**.

Rehearsal without spending Gemini calls: start the server with `BULLHORN_FAKE_GEMINI=1 uvicorn server:app --port 8000`. It returns a canned result that says "UI TEST ONLY" on screen. Never use it for judging.

### D. Arduino rover

1. Install **Arduino IDE 2** from arduino.cc/en/software. Plug the Uno in with the USB-B cable. Pick Tools › Board › **Arduino Uno**, then Tools › Port › the new `/dev/cu.usbserial…` or `/dev/cu.wchusbserial…` port.
   No new port? The clone uses a CH340 USB chip. Install the driver from https://www.wch-ic.com/downloads/CH34XSER_MAC_ZIP.html, then replug.
2. Open `rover/rover.ino`. The pins are already set to match the existing OSOYOO wiring (ENA 9, IN1 12, IN2 11, IN3 7, IN4 8, ENB 6). Change them only if your jumpers differ. Click **Upload**, then unplug USB, switch the battery ON, and press the Uno's **reset** button. After 3 seconds it drives.
3. Tune on the actual demo floor until it stops in front of the cow box:
   - One side spins backward → set `LEFT_REVERSED` or `RIGHT_REVERSED` to `true`.
   - Curves when it should go straight → lower the stronger side's trim (`LEFT_TRIM = 0.92`).
   - Too short or too far → change the ms numbers in `move(...)`. Turn not ~90° → change the turn ms.
   - Re-upload after each change (USB in, Upload, USB out). Tape the start mark and the cow box position on the floor.

### E. Rehearsal checklist (do 3 full runs)

- [ ] Server running, dashboard shows **LoRa mesh · Online**, Cow1 + Barn Station on the map
- [ ] Rover phone on `/cam`, camera started, shows "Ready for scan", Auto-Lock Never, phone charged
- [ ] 1. Shake the cardboard cow (5+ sharp shakes in 2 s) → Base beeps, Cow1 red + fly-to + "Head shaking detected · tag motion sensor" (backup: double-press the tag)
- [ ] 2. **Locate** → tag beeps
- [ ] 3. **Dispatch rover** + press Uno reset at the same moment → rover stops at the cow box
- [ ] 4. **Scan wound** → result sheet in under ~15 s, risk badge shows HIGH on the fake wound
- [ ] 5. **Copy** the FDACS draft
- [ ] 6. **Reset**, put the rover back on its start mark

---

## Frameworks, libraries and services

**Backend (Python):** FastAPI, Uvicorn, python-multipart, `google-genai` (Gemini API SDK), `meshtastic` Python library + CLI, PyPubSub (via meshtastic), pyserial (via meshtastic).

**Frontend:** Vite, React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Framer Motion, MapLibre GL JS v5, `react-map-gl` (`react-map-gl/maplibre`).

**Map imagery:** Esri World Imagery raster tiles (`server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`). Attribution: Esri, Maxar, Earthstar Geographics, and the GIS User Community. Shown on the map.

**Tag firmware:** Meshtastic firmware v2.7.26 (GPL-3.0) with our head-shake patch, built with PlatformIO; QMA6100P Arduino library (via Meshtastic).

**Services/tools:** Google Gemini API (Gemini Flash; `gemini-3.6-flash` with fallback to `gemini-3.8-flash`), Cloudflare quick tunnels (`cloudflared`), Meshtastic firmware on SenseCAP T1000-E, Arduino IDE / Arduino core.

**Vendor sample code:** `v2smartcar-lesson1/` is OSOYOO's Lesson 1 smart-car sketch, kept for wiring reference only. `rover/rover.ino` is our own code.

**Fonts / design:** System font stack only (San Francisco on Apple devices). The UI's design language is *inspired by* apple.com. No Apple logos, images, fonts or trademarked assets are used. The "Bullhorn" wordmark is plain text.

## AI usage (detailed credit)

- **Code generation:** All code in this repo (`server.py`, `frontend/`, `rover/rover.ino`, the firmware patch in `firmware/`, `scripts/`), plus this README, `PRD.md` and the setup steps, was generated during the event by **Claude Code (Anthropic's AI coding assistant, model Claude Opus 5.5)** from our written PRD and project brief. We reviewed it, ran it and iterated on it with the assistant.
- **Design skill:** The `apple-ui` skill (`.claude/skills/apple-ui/SKILL.md`) was written by Claude Code after studying apple.com (homepage, /iphone, /macbook-pro) and the CSS those pages ship (font sizes, letter-spacing, colors, radii, frosted-glass values, easing curves). The dashboard follows it. Inspired-by only.
- **Ranch location:** Claude Code picked the demo pasture by pulling Esri satellite images of eastern Hillsborough County and checking for open land with no houses. It then computed the boundary coordinates (~271 acres).
- **Runtime AI:** The app calls **Google Gemini** to triage the rover photo and draft the FDACS report. Its output is labeled triage-only and needs veterinarian confirmation.
- **What we did ourselves:** came up with the idea and wrote the problem framing and PRD brief; chose the hardware; built and wired the rover (chassis, motors, Model X driver, Uno, battery); configured the T1000-E tags with the meshtastic CLI; mounted the phone; set up the tunnel and API key; tuned the rover route, trims and timings on the demo floor; built the cardboard cow and fake wound; tested the full flow end to end; and gave the presentation.

## License

MIT for our code. Vendor sample code in `v2smartcar-lesson1/` remains © OSOYOO.
