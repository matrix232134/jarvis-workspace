import { NextRequest, NextResponse } from "next/server";

const BRIDGE_WS_URL = "wss://minipc-hwlmx-1.tail89fc92.ts.net:19300";
const UI_BASE_URL = "https://minipc-hwlmx-1.tail89fc92.ts.net";
const PAIRING_TOKEN = "0f78c90c-c00a-4a17-ac9b-15e1b1f531b5";

function windowsScript(deviceName: string): string {
  const bridgeWs = BRIDGE_WS_URL.replace("wss://", "ws://");
  return `@echo off
setlocal enabledelayedexpansion
title JARVIS Device Agent Setup

echo.
echo  JARVIS Device Agent Setup
echo  =========================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  ERROR: Node.js is required. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [1/5] Node.js found: %NODE_VER%

:: Set paths
set "INSTALL_DIR=%USERPROFILE%\\.jarvis-device-agent"
set "APP_DIR=%INSTALL_DIR%\\app"

:: Download agent bundle
echo  [2/5] Downloading agent...
if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
curl -sL "${UI_BASE_URL}/api/device-setup/bundle" -o "%INSTALL_DIR%\\agent.tar.gz"
tar -xzf "%INSTALL_DIR%\\agent.tar.gz" -C "%INSTALL_DIR%"
if exist "%INSTALL_DIR%\\jarvis-device-agent" rename "%INSTALL_DIR%\\jarvis-device-agent" app
del "%INSTALL_DIR%\\agent.tar.gz"
echo  Downloaded to %APP_DIR%

:: Install and build
echo  [3/5] Installing dependencies...
cd /d "%APP_DIR%"
call npm install --production=false >nul 2>&1
call npm run build >nul 2>&1
echo  Build complete

:: Write config
echo  [4/5] Writing config...
(
echo {
echo   "bridge": {
echo     "url": "${bridgeWs}",
echo     "deviceId": null,
echo     "token": null,
echo     "pairingToken": "${PAIRING_TOKEN}"
echo   },
echo   "device": {
echo     "name": "${deviceName}"
echo   },
echo   "capabilities": ["screen", "input", "clipboard", "apps", "notify", "files", "browser"],
echo   "voice": { "enabled": false },
echo   "security": {
echo     "killSwitchEnabled": true,
echo     "allowedPaths": ["%USERPROFILE%\\\\Documents", "%USERPROFILE%\\\\Desktop", "%USERPROFILE%\\\\Downloads"],
echo     "deniedPaths": ["C:\\\\Windows", "C:\\\\Program Files", "C:\\\\Program Files (x86)"],
echo     "auditLogPath": "%APP_DIR:\\=\\\\%\\\\audit.log",
echo     "maxScreenshotsPerMinute": 10,
echo     "maxInputActionsPerMinute": 60
echo   }
echo }
) > "%APP_DIR%\\device-agent-config.json"
echo  Config written

:: Register as startup task
echo  [5/5] Registering startup service...
for /f "tokens=*" %%p in ('where node') do set "NODE_EXE=%%p"
schtasks /delete /tn "JARVIS Device Agent" /f >nul 2>&1
schtasks /create /tn "JARVIS Device Agent" /tr "\\"%NODE_EXE%\\" \\"%APP_DIR%\\dist\\index.js\\"" /sc onlogon /rl highest /f >nul 2>&1
echo  Registered as logon task

:: Start now
echo.
echo  Starting agent...
start "" "%NODE_EXE%" "%APP_DIR%\\dist\\index.js"
timeout /t 3 /nobreak >nul
echo.
echo  JARVIS Device Agent is running. It will auto-start on login.
echo  Bridge: ${BRIDGE_WS_URL}
echo  Device: ${deviceName}
echo.
pause
`;
}

function unixScript(deviceName: string): string {
  return `#!/usr/bin/env bash
# JARVIS Device Agent — One-Click Setup (macOS/Linux)
# Run: bash jarvis-agent-setup.sh

set -euo pipefail

INSTALL_DIR="$HOME/.jarvis-device-agent"
APP_DIR="$INSTALL_DIR/app"
CONFIG_FILE="$APP_DIR/device-agent-config.json"
BUNDLE_URL="${UI_BASE_URL}/api/device-setup/bundle"
BRIDGE_URL="${BRIDGE_WS_URL}"
PAIRING_TOKEN="${PAIRING_TOKEN}"
DEVICE_NAME="${deviceName}"

echo "JARVIS Device Agent Setup"
echo "========================="

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is required. Install from https://nodejs.org"
    exit 1
fi
echo "[1/5] Node.js found: $(node --version)"

# Download agent bundle
echo "[2/5] Downloading agent..."
rm -rf "$APP_DIR"
mkdir -p "$INSTALL_DIR"
curl -sL "$BUNDLE_URL" | tar -xz -C "$INSTALL_DIR"
mv "$INSTALL_DIR/jarvis-device-agent" "$APP_DIR" 2>/dev/null || true
echo "  Downloaded to $APP_DIR"

# Install dependencies and build
echo "[3/5] Installing dependencies..."
cd "$APP_DIR"
npm install --production=false >/dev/null 2>&1
npm run build >/dev/null 2>&1
echo "  Build complete"

# Write config
echo "[4/5] Writing config..."
cat > "$CONFIG_FILE" << JSONEOF
{
  "bridge": {
    "url": "$(echo $BRIDGE_URL | sed 's/wss:/ws:/')",
    "deviceId": null,
    "token": null,
    "pairingToken": "$PAIRING_TOKEN"
  },
  "device": {
    "name": "$DEVICE_NAME"
  },
  "capabilities": ["screen", "input", "clipboard", "apps", "notify", "files", "browser"],
  "voice": { "enabled": false },
  "security": {
    "killSwitchEnabled": true,
    "allowedPaths": ["$HOME/Documents", "$HOME/Desktop", "$HOME/Downloads"],
    "deniedPaths": ["/usr", "/System", "/bin", "/sbin"],
    "auditLogPath": "$APP_DIR/audit.log",
    "maxScreenshotsPerMinute": 10,
    "maxInputActionsPerMinute": 60
  }
}
JSONEOF
echo "  Config written"

# Register as service
echo "[5/5] Registering startup service..."
if [[ "$(uname)" == "Darwin" ]]; then
    # macOS — launchd plist
    PLIST="$HOME/Library/LaunchAgents/com.jarvis.device-agent.plist"
    NODE_PATH="$(which node)"
    cat > "$PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.device-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$APP_DIR/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$APP_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/agent.err</string>
</dict>
</plist>
PLISTEOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "  Registered as launchd agent"
else
    # Linux — systemd user service
    mkdir -p "$HOME/.config/systemd/user"
    SERVICE="$HOME/.config/systemd/user/jarvis-device-agent.service"
    NODE_PATH="$(which node)"
    cat > "$SERVICE" << SVCEOF
[Unit]
Description=JARVIS Device Agent
After=network-online.target

[Service]
ExecStart=$NODE_PATH $APP_DIR/dist/index.js
WorkingDirectory=$APP_DIR
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SVCEOF
    systemctl --user daemon-reload
    systemctl --user enable jarvis-device-agent
    systemctl --user start jarvis-device-agent
    echo "  Registered as systemd user service"
fi

echo ""
echo "JARVIS Device Agent is running. It will auto-start on login."
echo "Bridge: $BRIDGE_URL"
echo "Device: $DEVICE_NAME"
`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const os = searchParams.get("os") || "windows";
  const deviceName = searchParams.get("name") || "Unknown-Device";

  if (os === "windows") {
    const script = windowsScript(deviceName);
    return new Response(script, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=jarvis-agent-setup.bat`,
      },
    });
  }

  const script = unixScript(deviceName);
  return new Response(script, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=jarvis-agent-setup.sh`,
    },
  });
}
