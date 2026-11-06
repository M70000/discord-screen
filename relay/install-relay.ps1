# Script de Instalacao Completo do Relay para OBS Studio
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

# Garante que roda no diretorio onde o script esta salvo
Set-Location -Path $PSScriptRoot

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      INSTALADOR COMPLETO DO RELAY DISCORD + OBS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este instalador configura tudo automaticamente no seu computador:"
Write-Host " 1. Verifica e instala o OBS Studio oficial mais recente (se necessario)"
Write-Host " 2. Baixa o servidor de transmissao MediaMTX e o Cloudflare Tunnel"
Write-Host " 3. Instala o script diretamente na pasta de instalacao do OBS"
Write-Host " 4. Configura o servidor RTMP (rtmp://localhost:1935/live) no OBS"
Write-Host ""

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
    Write-Host "  -> Baixando o instalador oficial mais recente do OBS Studio..." -ForegroundColor Cyan

    try {
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $obsRel = Invoke-RestMethod -Uri 'https://api.github.com/repos/obsproject/obs-studio/releases/latest' -Headers $headers -UseBasicParsing
        $obsAsset = $obsRel.assets | Where-Object { $_.name -like 'OBS-Studio-*-Windows-x64-Installer.exe' } | Select-Object -First 1

        if (-not $obsAsset) {
            $obsAsset = $obsRel.assets | Where-Object { $_.name -like '*Windows-x64*.exe' } | Select-Object -First 1
        }

        if ($obsAsset) {
            $obsInstallerPath = "$env:TEMP\$($obsAsset.name)"
            Write-Host "  -> Baixando $($obsAsset.name) (cerca de 130 MB)..." -ForegroundColor Cyan
            Invoke-WebRequest -Uri $obsAsset.browser_download_url -OutFile $obsInstallerPath -Headers $headers -UseBasicParsing

            Write-Host "  -> Executando o instalador do OBS Studio..." -ForegroundColor Yellow
            Write-Host "  -> Siga os passos na tela e conclua a instalacao do OBS." -ForegroundColor White
            $proc = Start-Process -FilePath $obsInstallerPath -Wait -PassThru
            Write-Host "  -> Instalacao do OBS finalizada!" -ForegroundColor Green
            Remove-Item $obsInstallerPath -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "  -> Nao foi possivel localizar o download automatico do OBS." -ForegroundColor Red
            Write-Host "  -> Baixe e instale o OBS manualmente em: https://obsproject.com/pt-br/download" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [FALHA] Erro ao baixar OBS: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  -> Voce pode baixar manualmente em: https://obsproject.com/pt-br/download" -ForegroundColor Yellow
    }
}

Write-Host ""

# ----------------------------------------------------
# 2. DOWNLOAD DO MEDIAMTX (SERVIDOR LOCAL)
# ----------------------------------------------------
Write-Host "[2/5] Verificando MediaMTX (Servidor de Streaming Local)..." -ForegroundColor Yellow
if (Test-Path "mediamtx.exe") {
    Write-Host "  -> mediamtx.exe presente localmente. [OK]" -ForegroundColor Green
} else {
    try {
        Write-Host "  -> Consultando versao mais recente do MediaMTX no GitHub..."
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/bluenviron/mediamtx/releases/latest' -Headers $headers -UseBasicParsing
        $asset = $rel.assets | Where-Object { $_.name -like '*windows_amd64.zip' } | Select-Object -First 1

        if ($asset) {
            Write-Host "  -> Baixando $($asset.name)..."
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "mediamtx.zip" -Headers $headers -UseBasicParsing
            Expand-Archive -Path "mediamtx.zip" -DestinationPath . -Force
            Remove-Item "mediamtx.zip" -Force -ErrorAction SilentlyContinue
            Remove-Item "LICENSE" -Force -ErrorAction SilentlyContinue
            Write-Host "  -> MediaMTX instalado com sucesso! [OK]" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [Aviso] Falha ao baixar MediaMTX: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

Write-Host ""

# ----------------------------------------------------
# 3. DOWNLOAD DO CLOUDFLARE QUICK TUNNEL
# ----------------------------------------------------
Write-Host "[3/5] Verificando Cloudflare Tunnel (cloudflared)..." -ForegroundColor Yellow
if (Test-Path "cloudflared.exe") {
    Write-Host "  -> cloudflared.exe presente localmente. [OK]" -ForegroundColor Green
} else {
    try {
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        Write-Host "  -> Baixando cloudflared-windows-amd64.exe..."
        Invoke-WebRequest -Uri $cfUrl -OutFile "cloudflared.exe" -Headers $headers -UseBasicParsing
        Write-Host "  -> Cloudflare Tunnel instalado com sucesso! [OK]" -ForegroundColor Green
    } catch {
        Write-Host "  [Aviso] Falha ao baixar cloudflared: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

Write-Host ""

# ----------------------------------------------------
# 4. INSTALACAO NA PASTA DO OBS STUDIO
# ----------------------------------------------------
Write-Host "[4/5] Instalando os arquivos do script na pasta do OBS..." -ForegroundColor Yellow

# Pasta de instalacao oficial dos scripts do OBS no AppData do usuario
$obsScriptsDir = "$env:APPDATA\obs-studio\plugin_config\scripts\discord-relay"
if (-not (Test-Path $obsScriptsDir)) {
    New-Item -ItemType Directory -Path $obsScriptsDir -Force | Out-Null
}

# Copia os arquivos essenciais para a pasta do OBS
$filesToCopy = @("obs-stream-sync.lua", "mediamtx.exe", "mediamtx.yml", "cloudflared.exe")
foreach ($f in $filesToCopy) {
    if (Test-Path $f) {
        Copy-Item -Path $f -Destination $obsScriptsDir -Force
        Write-Host "  -> Copiado $f para a pasta do OBS." -ForegroundColor Green
    }
}

# Pergunta o ID do Discord se o usuário quiser já salvar
Write-Host ""
$currentDiscordId = ""
if (Test-Path "$obsScriptsDir\obs-stream-sync.lua") {
    $luaContent = Get-Content "$obsScriptsDir\obs-stream-sync.lua" -Raw
    if ($luaContent -match 'DEFAULT_DISCORD_USER_ID\s*=\s*"([^"]+)"') {
        $currentDiscordId = $matches[1]
    }
}

Write-Host "----------------------------------------------------------" -ForegroundColor DarkCyan
if ($currentDiscordId -and $currentDiscordId -ne "") {
    Write-Host "ID do Discord atualmente configurado: $currentDiscordId" -ForegroundColor White
    $inputDiscordId = Read-Host "Pressione ENTER para manter esse ID, ou digite outro ID do Discord"
} else {
    Write-Host "Digite o seu ID de usuario do Discord (Ex: 381416868079992832):" -ForegroundColor White
    Write-Host "(Para pegar seu ID: no Discord, clique com botao direito no seu perfil -> Copiar ID de usuario)" -ForegroundColor Gray
    $inputDiscordId = Read-Host "ID do Discord"
}

if ($inputDiscordId -and $inputDiscordId.Trim() -ne "") {
    $cleanId = $inputDiscordId.Trim()
    $luaPath = "$obsScriptsDir\obs-stream-sync.lua"
    if (Test-Path $luaPath) {
        $luaContent = Get-Content $luaPath -Raw
        $luaContent = $luaContent -replace 'DEFAULT_DISCORD_USER_ID\s*=\s*"[^"]*"', "DEFAULT_DISCORD_USER_ID = `"$cleanId`""
        Set-Content -Path $luaPath -Value $luaContent -Encoding UTF8
        Write-Host "  -> ID do Discord ($cleanId) salvo com sucesso no script!" -ForegroundColor Green
    }
}

Write-Host ""

# ----------------------------------------------------
# 5. CONFIGURACAO AUTOMATICA DO OBS STUDIO
# ----------------------------------------------------
Write-Host "[5/5] Configurando o OBS Studio automaticamente..." -ForegroundColor Yellow

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
    Write-Host "  -> Perfil '$($folder.Name)' configurado para RTMP localhost:1935/live [OK]" -ForegroundColor Green
}

# Configura o script carregado na cena padrão do OBS
$obsScenesDir = "$env:APPDATA\obs-studio\basic\scenes"
if (Test-Path $obsScenesDir) {
    $sceneFiles = Get-ChildItem -Path $obsScenesDir -Filter "*.json"
    $targetLuaNormalized = "$obsScriptsDir\obs-stream-sync.lua".Replace('\', '/')

    foreach ($sf in $sceneFiles) {
        try {
            $jsonContent = Get-Content $sf.FullName -Raw | ConvertFrom-Json
            if (-not $jsonContent.modules) { $jsonContent | Add-Member -MemberType NoteProperty -Name "modules" -Value ([PSCustomObject]@{}) }
            if (-not $jsonContent.modules.'scripts-tool') {
                $jsonContent.modules | Add-Member -MemberType NoteProperty -Name "scripts-tool" -Value @()
            }

            # Verifica se o script ja esta listado
            $existing = $jsonContent.modules.'scripts-tool' | Where-Object { $_.path -like "*obs-stream-sync.lua" }
            if (-not $existing) {
                $scriptEntry = [PSCustomObject]@{
                    path = $targetLuaNormalized
                    settings = [PSCustomObject]@{
                        stream_key = "live"
                        bot_url = "https://discord-screen-relay.onrender.com"
                        discord_user_id = if ($inputDiscordId) { $inputDiscordId.Trim() } else { $currentDiscordId }
                        webhook_secret = "cbbf8a1f06c1b67fa5d87dc1c3a103b5769a5c80b717e3a598419b141f5b2daa"
                    }
                }
                $jsonContent.modules.'scripts-tool' += $scriptEntry
                $jsonContent | ConvertTo-Json -Depth 32 | Set-Content $sf.FullName -Encoding UTF8
                Write-Host "  -> Script ativado automaticamente na colecao de cenas '$($sf.BaseName)'! [OK]" -ForegroundColor Green
            }
        } catch {
            # Se a cena tiver formato especial, segue sem quebrar
        }
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            TUDO PRONTO! INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "O que foi feito:" -ForegroundColor White
Write-Host " ✔️ OBS Studio pronto no computador"
Write-Host " ✔️ Servidor MediaMTX e Cloudflare Tunnel prontos"
Write-Host " ✔️ Script instalado em:"
Write-Host "    $obsScriptsDir\obs-stream-sync.lua" -ForegroundColor Yellow
Write-Host " ✔️ Servidor RTMP e Chave do OBS pre-configurados"
Write-Host ""
Write-Host "COMO USAR NO OBS STUDIO:" -ForegroundColor Cyan
Write-Host " 1. Abra o OBS Studio."
Write-Host " 2. Se o script ainda nao aparecer carregado, va em:"
Write-Host "    Ferramentas -> Scripts -> clique no botao [+] e selecione:" -ForegroundColor Yellow
Write-Host "    $obsScriptsDir\obs-stream-sync.lua" -ForegroundColor White
Write-Host " 3. Clique em 'Iniciar Transmissao' no OBS!" -ForegroundColor Green
Write-Host "    O bot vai avisar a galera no Discord automaticamente com link e preview!"
Write-Host ""

$openObs = Read-Host "Deseja abrir o OBS Studio agora? (S/N)"
if ($openObs -match '^[sS]') {
    if (Test-Path $obsExe64) {
        Start-Process $obsExe64
    } elseif (Test-Path $obsExe32) {
        Start-Process $obsExe32
    }
}
