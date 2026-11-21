# Cow1 tag firmware: head-shake detection

Stock Meshtastic firmware reads the T1000-E's QMA6100P accelerometer but only uses it to wake a screen (the tag has no screen). This patch makes the Cow1 tag detect **head shaking** by itself and broadcast an alert over LoRa. No button press needed.

**How it works** (`src/motion/QMA6100PSensor.cpp`)
- It samples the accelerometer every 50 ms and measures how much the acceleration vector changes between samples, as a fraction of measured gravity. That makes it unit-independent.
- A change over `SHAKE_JOLT_THRESHOLD` (0.55 g) counts as a **jolt**. One swing gives one jolt (90 ms minimum gap).
- `SHAKE_JOLTS_REQUIRED` (5) jolts within `SHAKE_WINDOW_MS` (2 s) count as head shaking. Walking and grazing are too smooth to trigger it.
- On detection, the tag broadcasts the text `SHAKE Cow1: head shaking detected` + bell on the primary channel.
  - **The Base tag beeps** (its `external_notification.alert_message_buzzer` is on).
  - **The dashboard** shows a red alert labeled "Head shaking detected · tag motion sensor".
- A 12 s cooldown stops it spamming the mesh, and it ignores the first 8 s after boot.
- The double press still works as a fallback trigger. It shows on the dashboard as "tag button".

Based on Meshtastic firmware **v2.7.26.54e0d8d** (the version the tags shipped with). The patch only touches that one file.

## Build (macOS)

```bash
git clone --depth 1 --branch v2.7.26.54e0d8d --recurse-submodules --shallow-submodules https://github.com/meshtastic/firmware.git
cd firmware && git apply /path/to/hackjam-2026/firmware/bullhorn-head-shake.patch
python3 -m venv ../pio-venv && ../pio-venv/bin/pip install platformio
../pio-venv/bin/pio run -e tracker-t1000-e
```

The first build downloads the nRF52 toolchain, which takes about 10 minutes. The output is `.pio/build/tracker-t1000-e/firmware-*.uf2`.

## Flash Cow1

1. Stop the Bullhorn server. Connect **only the Cow1 tag** over USB.
2. Put it in update mode:
   ```bash
   meshtastic --enter-dfu
   ```
   A drive named **T1000-E** appears in Finder.
3. Copy the `.uf2` file onto that drive. The tag reboots by itself when the copy finishes. The macOS "disk not ejected properly" warning is normal.
4. Settings (name, channel, position) are kept. Check with `meshtastic --info`: Owner should still be Cow1.

## Tuning

Shake too hard to trigger? Lower `SHAKE_JOLT_THRESHOLD` (for example 0.4) or `SHAKE_JOLTS_REQUIRED` (4). False alarms when you just carry it? Raise them. Rebuild and reflash after each change.

To undo, flash stock firmware from flasher.meshtastic.org.
