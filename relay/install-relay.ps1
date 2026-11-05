# Script de Instalacao do Relay para OBS Studio
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Garante que roda no diretorio onde o script esta salvo
Set-Location -Path $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    INSTALADOR DO RELAY OBS (MediaMTX + Cloudflare)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este utilitario vai preparar os executaveis necessarios para"
Write-Host "transmitir pelo OBS Studio com qualidade 1080p 60fps lisos."
Write-Host ""

# 1. Download do MediaMTX
Write-Host "[1/2] Baixando MediaMTX (Servidor de Midia)..." -ForegroundColor Yellow
if (Test-Path "mediamtx.exe") {
    Write-Host "  -> mediamtx.exe ja esta presente na pasta. Pulando download." -ForegroundColor Green
} else {
    try {
        Write-Host "  -> Consultando versao mais recente no GitHub..."
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/bluenviron/mediamtx/releases/latest' -Headers $headers -UseBasicParsing
        $asset = $rel.assets | Where-Object { $_.name -like '*windows_amd64.zip' } | Select-Object -First 1

        if (-not $asset) {
            throw "Arquivo windows_amd64.zip nao encontrado no release."
        }

        Write-Host "  -> Baixando $($asset.name)..."
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "mediamtx.zip" -Headers $headers -UseBasicParsing

        Write-Host "  -> Extraindo mediamtx.exe..."
        $customConfig = if (Test-Path "mediamtx.yml") { Get-Content "mediamtx.yml" -Raw } else { $null }
        Expand-Archive -Path "mediamtx.zip" -DestinationPath . -Force
        Remove-Item "mediamtx.zip" -Force -ErrorAction SilentlyContinue
        Remove-Item "LICENSE" -Force -ErrorAction SilentlyContinue

        if ($customConfig) {
            Set-Content -Path "mediamtx.yml" -Value $customConfig
        }

        if (Test-Path "mediamtx.exe") {
            Write-Host "  -> MediaMTX instalado com sucesso!" -ForegroundColor Green
        } else {
            throw "Falha ao extrair mediamtx.exe"
        }
    } catch {
        Write-Host "  [FALHA] Nao foi possivel baixar o MediaMTX automaticamente: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Voce pode baixar manualmente em: https://github.com/bluenviron/mediamtx/releases/latest" -ForegroundColor DarkYellow
    }
}

Write-Host ""

# 2. Download do Cloudflare Tunnel
Write-Host "[2/2] Baixando Cloudflare Quick Tunnel (cloudflared)..." -ForegroundColor Yellow
if (Test-Path "cloudflared.exe") {
    Write-Host "  -> cloudflared.exe ja esta presente na pasta. Pulando download." -ForegroundColor Green
} else {
    try {
        $headers = @{ 'User-Agent' = 'Mozilla/5.0' }
        $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        Write-Host "  -> Baixando cloudflared-windows-amd64.exe..."
        Invoke-WebRequest -Uri $cfUrl -OutFile "cloudflared.exe" -Headers $headers -UseBasicParsing

        if (Test-Path "cloudflared.exe") {
            Write-Host "  -> Cloudflare Tunnel instalado com sucesso!" -ForegroundColor Green
        } else {
            throw "Falha ao salvar cloudflared.exe"
        }
    } catch {
        Write-Host "  [FALHA] Nao foi possivel baixar o cloudflared automaticamente: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Voce pode baixar manualmente em: https://github.com/cloudflare/cloudflared/releases/latest" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                CONFIGURACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos no OBS Studio (feita apenas 1 vez):"
Write-Host ""
Write-Host "1. Abra o OBS Studio."
Write-Host "2. Va em: Ferramentas -> Scripts."
Write-Host "3. Clique no botao [+] e selecione o arquivo:" -ForegroundColor Yellow
Write-Host "   $PSScriptRoot\obs-stream-sync.lua" -ForegroundColor White
Write-Host "4. Preencha seu ID do Discord, a URL do Bot e a Chave Secreta."
Write-Host "5. Em Configuracoes -> Transmissao no OBS:" -ForegroundColor Yellow
Write-Host "   - Servico: Personalizado..."
Write-Host "   - Servidor: rtmp://localhost:1935/live"
Write-Host "   - Chave: live"
Write-Host ""
Write-Host "Pronto! Sempre que clicar em 'Iniciar Transmissao', o bot" -ForegroundColor Green
Write-Host "avisara a galera automaticamente no canal #telamento!" -ForegroundColor Green
Write-Host ""
