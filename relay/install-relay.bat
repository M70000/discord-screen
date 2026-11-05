@echo off
chcp 65001 > nul
title Instalador do Relay OBS - Discord Screen Share
color 0B

echo ==========================================================
echo    INSTALADOR DO RELAY OBS (MediaMTX + Cloudflare)
echo ==========================================================
echo.
echo Este script vai baixar os executaveis portateis necessarios
echo para o OBS transmitir sua tela com aceleracao de GPU e
echo custo zero diretamente para o Bot do Discord.
echo.

cd /d "%~dp0"

echo [1/3] Verificando dependencias...
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] PowerShell nao foi encontrado no sistema!
    pause
    exit /b 1
)

echo.
echo [2/3] Baixando MediaMTX (Servidor de Midia RTMP/HLS)...
powershell -NoProfile -Command ^
    "$ProgressPreference = 'SilentlyContinue'; " ^
    "try { " ^
    "  Write-Host 'Consultando versao mais recente do MediaMTX...'; " ^
    "  $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/bluenviron/mediamtx/releases/latest'; " ^
    "  $asset = $rel.assets | Where-Object { $_.name -like '*windows_amd64.zip' } | Select-Object -First 1; " ^
    "  Write-Host ('Baixando ' + $asset.name + '...'); " ^
    "  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile 'mediamtx.zip'; " ^
    "  Expand-Archive -Path 'mediamtx.zip' -DestinationPath . -Force; " ^
    "  Remove-Item 'mediamtx.zip' -Force; " ^
    "  Write-Host 'MediaMTX instalado com sucesso!' -ForegroundColor Green; " ^
    "} catch { " ^
    "  Write-Host ('Erro ao baixar MediaMTX: ' + $_.Exception.Message) -ForegroundColor Red; " ^
    "}"

echo.
echo [3/3] Baixando Cloudflare Tunnel (cloudflared)...
powershell -NoProfile -Command ^
    "$ProgressPreference = 'SilentlyContinue'; " ^
    "try { " ^
    "  Write-Host 'Baixando cloudflared.exe...'; " ^
    "  $cfUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'; " ^
    "  Invoke-WebRequest -Uri $cfUrl -OutFile 'cloudflared.exe'; " ^
    "  Write-Host 'Cloudflare Tunnel instalado com sucesso!' -ForegroundColor Green; " ^
    "} catch { " ^
    "  Write-Host ('Erro ao baixar cloudflared: ' + $_.Exception.Message) -ForegroundColor Red; " ^
    "}"

echo.
echo ==========================================================
echo                INSTALAÇÃO CONCLUÍDA!
echo ==========================================================
echo.
echo Proximos passos no OBS Studio:
echo.
echo 1. Abra o OBS Studio.
echo 2. Va em: Ferramentas -> Scripts.
echo 3. Clique no botao [+] e selecione o arquivo:
echo    "%~dp0obs-stream-sync.lua"
echo 4. Preencha seu ID do Discord e a URL do Bot nas propriedades.
echo 5. Em Configuracoes -> Transmissao:
echo    - Servico: Personalizado...
echo    - Servidor: rtmp://localhost:1935/live
echo    - Chave: live
echo.
echo Agora, sempre que clicar em "Iniciar Transmissao", o bot
echo avisara a galera automaticamente no canal #telamento!
echo.
pause
