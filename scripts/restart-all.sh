#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/4] Stop old processes"
pkill -f 'node src/server.js' 2>/dev/null || true
pkill -f 'cloudflared tunnel --url' 2>/dev/null || true
sudo pkill -f dual_fwd.py 2>/dev/null || true
sleep 1

echo "[2/4] Ensure SQLite seed"
node src/seed.js || true

echo "[3/4] Start app on :3847"
# Preserve DeepSeek key from current environment (never echo the value)
if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "WARN: DEEPSEEK_API_KEY not set in environment; PPT/game theming LLM will be limited"
fi
# Restore then add lo alias for CF edge hijack workaround
sudo ip addr del 198.18.0.1/32 dev lo 2>/dev/null || true
node src/server.js > /tmp/forgeatoms-server.log 2>&1 &
sleep 1
curl -sf http://127.0.0.1:3847/health

# Resolve edge IPs and refresh dual_fwd if needed
if [[ -f "$ROOT/scripts/dual_fwd.py" ]]; then
  sudo ip addr add 198.18.0.1/32 dev lo 2>/dev/null || true
  sudo python3 "$ROOT/scripts/dual_fwd.py" > /tmp/dual-fwd.out 2>&1 &
  sleep 1
fi

echo "[4/4] Start cloudflared"
cloudflared tunnel --url http://127.0.0.1:3847 --protocol http2 --no-autoupdate > /tmp/cf-forge.out 2>&1 &
sleep 12
URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-forge.out | head -1 || true)
if [[ -n "${URL}" ]]; then
  echo "$URL" > "$ROOT/DEPLOY_URL.txt"
  echo "Public URL: $URL"
else
  echo "Tunnel URL not ready yet; check /tmp/cf-forge.out"
fi
echo "Local URL: http://127.0.0.1:3847/"
