# Script de Instalacao Completo e Automatizado do Relay para OBS Studio
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'Continue'

# Garante que roda no diretorio onde o script esta salvo
Set-Location -Path $PSScriptRoot

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      INSTALADOR COMPLETO DO RELAY DISCORD + OBS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este instalador configura tudo automaticamente no seu computador:"
Write-Host " 1. Verifica e instala o OBS Studio oficial mais recente (se necessario)"
Write-Host " 2. Prepara o script de transmissao na pasta oficial do OBS"
Write-Host " 3. Baixa o servidor de midia MediaMTX e o Cloudflare Tunnel"
Write-Host " 4. Configura a saida RTMP do OBS para rtmp://localhost:1935/live"
Write-Host ""

# Funcao de download acelerado com barra de progresso visual
function Download-FileWithVisualProgress($url, $destination, $desc) {
    Write-Host "  -> $desc" -ForegroundColor Cyan

    # 1. Tenta curl.exe com barra de progresso visual nativa (presente no Windows 10/11)
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        Write-Host "     (Baixando via curl acelerado com progresso...)" -ForegroundColor Gray
        & curl.exe -L --progress-bar -o "$destination" "$url"
        if (Test-Path "$destination") {
            $len = (Get-Item "$destination").Length
            if ($len -gt 100000) {
                return $true
            }
        }
    }

    # 2. Tenta BITS Transfer do Windows
    try {
        Write-Host "     (Baixando via BITS Transfer...)" -ForegroundColor Gray
        Start-BitsTransfer -Source $url -Destination $destination -DisplayName $desc -ErrorAction Stop
        if (Test-Path "$destination" -and (Get-Item "$destination").Length -gt 100000) {
            return $true
        }
    } catch {}

    # 3. Fallback com WebClient
    try {
        Write-Host "     (Baixando via WebClient...)" -ForegroundColor Gray
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        $wc.DownloadFile($url, $destination)
        if (Test-Path "$destination" -and (Get-Item "$destination").Length -gt 100000) {
            return $true
        }
    } catch {}

    return $false
}

# ----------------------------------------------------
# 1. VERIFICACAO E INSTALACAO DO OBS STUDIO
# ----------------------------------------------------
Write-Host "[1/5] Verificando se o OBS Studio esta instalado..." -ForegroundColor Yellow
$obsExe64 = "C:\Program Files\obs-studio\bin\64bit\obs64.exe"
$obsExe32 = "C:\Program Files (x86)\obs-studio\bin\32bit\obs32.exe"
$obsInstalled = (Test-Path $obsExe64) -or (Test-Path $obsExe32)

if ($obsInstalled) {
    Write-Host "  -> OBS Studio ja esta instalado no computador! [OK]" -ForegroundColor Green
} else {
    Write-Host "  -> OBS Studio NAO foi encontrado no computador." -ForegroundColor DarkYellow
    $installedViaWinget = $false

    # Tenta via winget silencioso primeiro
    if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
        Write-Host "  -> Tentando instalar automaticamente via Windows Package Manager (winget)..." -ForegroundColor Cyan
        try {
            $p = Start-Process -FilePath "winget.exe" -ArgumentList "install OBSProject.OBSStudio --accept-source-agreements --accept-package-agreements" -NoNewWindow -Wait -PassThru
            if ($p.ExitCode -eq 0 -or (Test-Path $obsExe64)) {
                $installedViaWinget = $true
                Write-Host "  -> OBS Studio instalado com sucesso via winget! [OK]" -ForegroundColor Green
            }
        } catch {}
    }

    if (-not $installedViaWinget -and -not (Test-Path $obsExe64)) {
        Write-Host "  -> Baixando o instalador oficial do OBS Studio..." -ForegroundColor Cyan

        # Obtem a URL do release mais recente com fallback direto
        $obsDownloadUrl = "https://github.com/obsproject/obs-studio/releases/download/33.0.1/OBS-Studio-33.0.1-Windows-x64-Installer.exe"
        $obsFileName = "OBS-Studio-Windows-x64-Installer.exe"

        try {
            $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
            $obsRel = Invoke-RestMethod -Uri 'https://api.github.com/repos/obsproject/obs-studio/releases/latest' -Headers $headers -UseBasicParsing -TimeoutSec 10
            $obsAsset = $obsRel.assets | Where-Object { $_.name -like 'OBS-Studio-*-Windows-x64-Installer.exe' } | Select-Object -First 1
            if ($obsAsset) {
                $obsDownloadUrl = $obsAsset.browser_download_url
                $obsFileName = $obsAsset.name
            }
        } catch {}

        $obsInstallerPath = "$env:TEMP\$obsFileName"
        $downloadOk = Download-FileWithVisualProgress $obsDownloadUrl $obsInstallerPath "Baixando OBS Studio oficial (~130 MB)..."

        if ($downloadOk -and (Test-Path $obsInstallerPath)) {
            Write-Host "  -> Download concluido! Executando instalador do OBS Studio..." -ForegroundColor Green
            Write-Host "  -> Siga os passos na janela do instalador e conclua a instalacao." -ForegroundColor White
            Start-Process -FilePath $obsInstallerPath -Wait
            Remove-Item $obsInstallerPath -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Instalador do OBS finalizado!" -ForegroundColor Green
        } else {
            Write-Host "  [AVISO] Nao foi possivel baixar o OBS automaticamente." -ForegroundColor Red
            Write-Host "  Baixe e instale o OBS manualmente pelo site: https://obsproject.com/pt-br/download" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# ----------------------------------------------------
# 2. DIRETORIO DE INSTALACAO NO OBS STUDIO
# ----------------------------------------------------
Write-Host "[2/5] Preparando pasta de scripts do OBS..." -ForegroundColor Yellow
$obsScriptsDir = "$env:APPDATA\obs-studio\plugin_config\scripts\discord-relay"
if (-not (Test-Path $obsScriptsDir)) {
    New-Item -ItemType Directory -Path $obsScriptsDir -Force | Out-Null
}
Write-Host "  -> Pasta do OBS: $obsScriptsDir [OK]" -ForegroundColor Green

Write-Host ""

# ----------------------------------------------------
# 3. INSTALACAO DO SCRIPT LUA E ARQUIVOS DE CONFIGURACAO
# ----------------------------------------------------
Write-Host "[3/5] Instalando script de transmissao e configuracoes..." -ForegroundColor Yellow

# Script Lua
$targetLua = "$obsScriptsDir\obs-stream-sync.lua"
if (Test-Path "$PSScriptRoot\obs-stream-sync.lua") {
    Copy-Item -Path "$PSScriptRoot\obs-stream-sync.lua" -Destination $targetLua -Force
    Write-Host "  -> obs-stream-sync.lua copiado com sucesso! [OK]" -ForegroundColor Green
} elseif (-not (Test-Path $targetLua)) {
    Write-Host "  -> Baixando obs-stream-sync.lua do servidor..." -ForegroundColor Cyan
    $luaUrl = "https://raw.githubusercontent.com/M70000/discord-screen/main/relay/obs-stream-sync.lua"
    Download-FileWithVisualProgress $luaUrl $targetLua "Baixando obs-stream-sync.lua..." | Out-Null
}

# Config YAML do MediaMTX
$targetYml = "$obsScriptsDir\mediamtx.yml"
if (Test-Path "$PSScriptRoot\mediamtx.yml") {
    Copy-Item -Path "$PSScriptRoot\mediamtx.yml" -Destination $targetYml -Force
    Write-Host "  -> mediamtx.yml copiado com sucesso! [OK]" -ForegroundColor Green
} elseif (-not (Test-Path $targetYml)) {
    $ymlUrl = "https://raw.githubusercontent.com/M70000/discord-screen/main/relay/mediamtx.yml"
    Download-FileWithVisualProgress $ymlUrl $targetYml "Baixando mediamtx.yml..." | Out-Null
}

Write-Host ""

# ----------------------------------------------------
# 4. DOWNLOAD E COPIA DO MEDIAMTX E CLOUDFLARED
# ----------------------------------------------------
Write-Host "[4/5] Instalando servidor MediaMTX e Cloudflare Tunnel..." -ForegroundColor Yellow

$targetMediaMtx = "$obsScriptsDir\mediamtx.exe"
if (Test-Path "$PSScriptRoot\mediamtx.exe") {
    Copy-Item -Path "$PSScriptRoot\mediamtx.exe" -Destination $targetMediaMtx -Force
    Write-Host "  -> mediamtx.exe instalado com sucesso! [OK]" -ForegroundColor Green
} elseif (-not (Test-Path $targetMediaMtx)) {
    try {
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/bluenviron/mediamtx/releases/latest' -Headers $headers -UseBasicParsing -TimeoutSec 10
        $asset = $rel.assets | Where-Object { $_.name -like '*windows_amd64.zip' } | Select-Object -First 1

        if ($asset) {
            $zipPath = "$env:TEMP\mediamtx.zip"
            Download-FileWithVisualProgress $asset.browser_download_url $zipPath "Baixando MediaMTX..." | Out-Null
            Expand-Archive -Path $zipPath -DestinationPath $obsScriptsDir -Force
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            Remove-Item "$obsScriptsDir\LICENSE" -Force -ErrorAction SilentlyContinue
            Write-Host "  -> MediaMTX instalado com sucesso! [OK]" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [Aviso] Falha ao baixar MediaMTX: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  -> mediamtx.exe ja estava presente na pasta. [OK]" -ForegroundColor Green
}

$targetCloudflared = "$obsScriptsDir\cloudflared.exe"
if (Test-Path "$PSScriptRoot\cloudflared.exe") {
    Copy-Item -Path "$PSScriptRoot\cloudflared.exe" -Destination $targetCloudflared -Force
    Write-Host "  -> cloudflared.exe instalado com sucesso! [OK]" -ForegroundColor Green
} elseif (-not (Test-Path $targetCloudflared)) {
    $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Download-FileWithVisualProgress $cfUrl $targetCloudflared "Baixando Cloudflare Tunnel..." | Out-Null
    if (Test-Path $targetCloudflared) {
        Write-Host "  -> Cloudflare Tunnel instalado com sucesso! [OK]" -ForegroundColor Green
    }
} else {
    Write-Host "  -> cloudflared.exe ja estava presente na pasta. [OK]" -ForegroundColor Green
}

Write-Host ""

# ----------------------------------------------------
# 5. CONFIGURACAO DO DISCORD ID E PERFIL DO OBS
# ----------------------------------------------------
Write-Host "[5/5] Configurando ID do Discord e saida de transmissao do OBS..." -ForegroundColor Yellow

$currentDiscordId = ""
if (Test-Path $targetLua) {
    $luaContent = Get-Content $targetLua -Raw
    if ($luaContent -match 'DEFAULT_DISCORD_USER_ID\s*=\s*"([^"]+)"') {
        $currentDiscordId = $matches[1]
    }
}

Write-Host "----------------------------------------------------------" -ForegroundColor DarkCyan
if ($currentDiscordId -and $currentDiscordId -ne "") {
    Write-Host "ID do Discord configurado atualmente: $currentDiscordId" -ForegroundColor White
    $inputDiscordId = Read-Host "Pressione ENTER para manter, ou digite o seu ID do Discord"
} else {
    Write-Host "Digite o seu ID de usuario do Discord (Ex: 381416868079992832):" -ForegroundColor White
    Write-Host "(Para copiar: no Discord, clique com botao direito no seu perfil -> 'Copiar ID de usuario')" -ForegroundColor Gray
    $inputDiscordId = Read-Host "ID do Discord"
}

$finalId = if ($inputDiscordId -and $inputDiscordId.Trim() -ne "") { $inputDiscordId.Trim() } else { $currentDiscordId }

if ($finalId -and $finalId -ne "") {
    if (Test-Path $targetLua) {
        $luaContent = Get-Content $targetLua -Raw
        $luaContent = $luaContent -replace 'DEFAULT_DISCORD_USER_ID\s*=\s*"[^"]*"', "DEFAULT_DISCORD_USER_ID = `"$finalId`""
        Set-Content -Path $targetLua -Value $luaContent -Encoding UTF8
        Write-Host "  -> ID do Discord ($finalId) salvo no script com sucesso! [OK]" -ForegroundColor Green
    }
}

# Configura o serviço RTMP em todos os perfis do OBS
$obsProfilesDir = "$env:APPDATA\obs-studio\basic\profiles"
$serviceConfig = '{"type":"rtmp_custom","settings":{"server":"rtmp://localhost:1935/live","use_auth":false,"bwtest":false,"key":"live"}}'

if (-not (Test-Path $obsProfilesDir)) {
    New-Item -ItemType Directory -Path "$obsProfilesDir\Sem_nome" -Force | Out-Null
}

$profileFolders = Get-ChildItem -Path $obsProfilesDir -Directory
if ($profileFolders.Count -eq 0) {
    New-Item -ItemType Directory -Path "$obsProfilesDir\Sem_nome" -Force | Out-Null
    $profileFolders = Get-ChildItem -Path $obsProfilesDir -Directory
}

foreach ($folder in $profileFolders) {
    $serviceJsonPath = Join-Path $folder.FullName "service.json"
    Set-Content -Path $serviceJsonPath -Value $serviceConfig -Encoding UTF8
    Write-Host "  -> Perfil '$($folder.Name)' pre-configurado para rtmp://localhost:1935/live [OK]" -ForegroundColor Green
}

# Auto-registra o script nas colecoes de cena do OBS
$obsScenesDir = "$env:APPDATA\obs-studio\basic\scenes"
if (Test-Path $obsScenesDir) {
    $sceneFiles = Get-ChildItem -Path $obsScenesDir -Filter "*.json"
    $targetLuaNormalized = $targetLua.Replace('\', '/')

    foreach ($sf in $sceneFiles) {
        try {
            $jsonContent = Get-Content $sf.FullName -Raw | ConvertFrom-Json
            if (-not $jsonContent.modules) { $jsonContent | Add-Member -MemberType NoteProperty -Name "modules" -Value ([PSCustomObject]@{}) }
            if (-not $jsonContent.modules.'scripts-tool') {
                $jsonContent.modules | Add-Member -MemberType NoteProperty -Name "scripts-tool" -Value @()
            }

            $existing = $jsonContent.modules.'scripts-tool' | Where-Object { $_.path -like "*obs-stream-sync.lua" }
            if (-not $existing) {
                $scriptEntry = [PSCustomObject]@{
                    path = $targetLuaNormalized
                    settings = [PSCustomObject]@{
                        stream_key = "live"
                        bot_url = "https://discord-screen-relay.onrender.com"
                        discord_user_id = $finalId
                        webhook_secret = "cbbf8a1f06c1b67fa5d87dc1c3a103b5769a5c80b717e3a598419b141f5b2daa"
                    }
                }
                $jsonContent.modules.'scripts-tool' += $scriptEntry
                $jsonContent | ConvertTo-Json -Depth 32 | Set-Content $sf.FullName -Encoding UTF8
                Write-Host "  -> Script ativado automaticamente na cena '$($sf.BaseName)'! [OK]" -ForegroundColor Green
            }
        } catch {}
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            TUDO PRONTO! INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resumo da instalacao:" -ForegroundColor White
Write-Host " ✔️ OBS Studio pronto"
Write-Host " ✔️ Script e executaveis instalados na pasta do OBS:"
Write-Host "    $obsScriptsDir" -ForegroundColor Yellow
Write-Host " ✔️ Transmissao RTMP pre-configurada (rtmp://localhost:1935/live)"
Write-Host " ✔️ Script ativado automaticamente no OBS"
Write-Host ""
Write-Host "COMO TRANSMITIR:" -ForegroundColor Cyan
Write-Host " 1. Abra o OBS Studio."
Write-Host " 2. Se o script ainda nao aparecer carregado, va em:"
Write-Host "    Ferramentas -> Scripts -> clique no botao [+] e selecione:" -ForegroundColor Yellow
Write-Host "    $targetLua" -ForegroundColor White
Write-Host " 3. Adicione o seu jogo na tela e clique em 'Iniciar Transmissao' no OBS!" -ForegroundColor Green
Write-Host "    O bot avisa a galera no canal #telamento automaticamente com preview!"
Write-Host ""

$openObs = Read-Host "Deseja abrir o OBS Studio agora? (S/N)"
if ($openObs -match '^[sS]') {
    if (Test-Path $obsExe64) {
        Start-Process $obsExe64
    } elseif (Test-Path $obsExe32) {
        Start-Process $obsExe32
    }
}
