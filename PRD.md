# Bullhorn — PRD

**Early warning for New World screwworm, built for the open range.**
HackJam '26 (USF SHPE) · Tracks: Best Overall, Home Turf, Off the Grid, Gemini API

## Problem
New World screwworm (*Cochliomyia hominivorax*) is a flesh-eating parasite. The first U.S. domestic-animal case of the current outbreak was confirmed in Texas cattle in June 2026. Florida (~1.58M cattle, 9th in U.S. beef cows; ground zero of the 2016–17 Keys outbreak) is under emergency import rules. Detection depends on inspecting every animal for wounds. That doesn't scale across huge pastures with no cell signal.

## Users
Florida cow-calf ranchers and ranch hands; downstream: FDACS Division of Animal Industry and their vet.

## Solution
Each cow wears a cheap LoRa mesh tag. When a tag detects irritated behavior (head shaking, biting at a wound), the ranch dashboard flags that cow on a live satellite map. The rancher beeps the tag to find it, dispatches a camera rover, and Gemini returns a screwworm risk triage plus a draft FDACS report. **Triage only, never a diagnosis.**

## Demo flow (must work first try)
1. Double-press Cow1 tag (stands in for motion sensor) → Cow1 turns red on map within seconds, map flies to it, alert card slides in.
2. **Locate** → Cow1 tag beeps over LoRa.
3. **Dispatch rover** → rover animates barn → Cow1 on map; real rover drives its hardcoded route (Uno reset).
4. **Scan wound** → rover iPhone (`/cam`) captures within ~1 s → Gemini → result sheet: photo, LOW/MEDIUM/HIGH, confidence, findings, action, FDACS draft + Copy.
5. **Reset**.

## Scope
- In: FastAPI `server.py` (Meshtastic serial + Gemini + static SPA), React dashboard (map, herd panel, alert/rover/scan flow, result sheet), `/cam` page, Arduino route sketch, README with AI credits.
- Honest labels: ~40 **simulated** herd nodes (toggle), rover map animation is a visualization, tag positions are fixed (GPS doesn't work indoors), manual backup alerts are labeled "Manual".
- Out: database, auth, Docker, websockets, rover sensors/autonomy, real diagnosis.

## Success criteria
- Tag press → red on map in < 5 s. Scan → result in < 15 s.
- Server runs with no tag plugged in (camera + Gemini still work).
- Looks like a polished product on a projector and an iPhone (see `.claude/skills/apple-ui`).

## Risks → mitigations
LoRa packet missed → backup "Simulate alert" (labeled). Tunnel down → laptop dashboard still works on `localhost:8000`. Gemini slow/error → inline error, retry. Rover drift → tuned trims, taped start mark.
