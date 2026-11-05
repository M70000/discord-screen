@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0install-relay.ps1" (
    echo Baixando scripts complementares do Relay...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/M70000/discord-screen/main/relay/install-relay.ps1' -OutFile '%~dp0install-relay.ps1' -UseBasicParsing; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/M70000/discord-screen/main/relay/obs-stream-sync.lua' -OutFile '%~dp0obs-stream-sync.lua' -UseBasicParsing; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/M70000/discord-screen/main/relay/mediamtx.yml' -OutFile '%~dp0mediamtx.yml' -UseBasicParsing"
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-relay.ps1"
echo.
pause
