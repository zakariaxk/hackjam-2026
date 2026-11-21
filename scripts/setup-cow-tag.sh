#!/usr/bin/env bash
# Configure the plugged-in T1000-E as "Cow1" (tag #1).
# Usage: stop the server first, plug in ONLY the Cow1 tag, then:  ./scripts/setup-cow-tag.sh
# Copies the radio channel from MESH_CHANNEL_URL in .env so both tags share one private mesh.
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate

URL=$(sed -n 's/^MESH_CHANNEL_URL=//p' .env 2>/dev/null || true)
if [ -z "$URL" ]; then
  echo "MESH_CHANNEL_URL missing in .env. Plug in the Base tag and run: meshtastic --info | grep 'Primary channel URL'"
  exit 1
fi

wait_tag() { for _ in $(seq 1 20); do ls /dev/cu.usbmodem* >/dev/null 2>&1 && { sleep 4; return; }; sleep 2; done; echo "Tag not found on USB"; exit 1; }
run() { echo "→ meshtastic $*"; for t in 1 2 3; do meshtastic "$@" && return; echo "  retrying after reboot…"; sleep 6; wait_tag; done; exit 1; }

wait_tag
run --seturl "$URL"                      # same channel + LoRa region/preset as Base (tag reboots)
wait_tag
run --set-owner "Cow1" --set-owner-short "COW1"
wait_tag
run --setlat 27.827267 --setlon -82.162216
wait_tag
run --set external_notification.enabled true --set external_notification.alert_bell true \
    --set external_notification.alert_bell_buzzer true --set external_notification.alert_message_buzzer true \
    --set external_notification.use_pwm true \
    --set position.position_broadcast_secs 3600 --set position.position_broadcast_smart_enabled false \
    --set telemetry.device_update_interval 3600
wait_tag
echo
meshtastic --info | grep -E '^Owner|"myNodeNum"' || true
ID=$(meshtastic --info | python3 -c "import sys,re; t=sys.stdin.read(); m=re.search(r'Owner: Cow1.*?\n', t); n=re.search(r'\"myNodeNum\": (\d+)', t); print('!%08x' % int(n.group(1)) if n else '')")
echo "Cow1 node ID: $ID   (paste into COW_ID in server.py)"
