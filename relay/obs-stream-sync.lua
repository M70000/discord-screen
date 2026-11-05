local obs = obslua

local DEFAULT_BOT_URL = "https://discord-screen-relay.onrender.com"
local DEFAULT_WEBHOOK_SECRET = "cbbf8a1f06c1b67fa5d87dc1c3a103b5769a5c80b717e3a598419b141f5b2daa"
local DEFAULT_STREAM_KEY = "live"

local bot_url = DEFAULT_BOT_URL
local discord_user_id = ""
local webhook_secret = DEFAULT_WEBHOOK_SECRET
local stream_key = DEFAULT_STREAM_KEY

local script_dir = ""
local log_file = ""
local tunnel_timer_active = false
local attempts = 0
local max_attempts = 20

-- Executa um comando silenciosamente no Windows sem exibir janela CMD
local function run_hidden(cmd)
    local escaped_cmd = cmd:gsub('"', '""')
    local ps_cmd = string.format('powershell -NoProfile -WindowStyle Hidden -Command "%s"', escaped_cmd)
    os.execute(ps_cmd)
end

-- Envia requisição HTTP POST para o bot usando PowerShell nativo do Windows
local function send_bot_webhook(endpoint, payload_table)
    if discord_user_id == "" or bot_url == "" then
        print("[OBS Sync] ID do Discord ou URL do Bot vazios. Webhook ignorado.")
        return
    end

    local clean_bot_url = bot_url:gsub("/+$", "")
    local full_url = clean_bot_url .. endpoint

    local u = payload_table.userId or discord_user_id
    local s = payload_table.streamUrl or ""
    local sec = payload_table.secret or webhook_secret

    local ps_script
    if s ~= "" then
        ps_script = string.format(
            "$u = '%s'; $s = '%s'; $sec = '%s'; " ..
            "$body = @{ userId = $u; streamUrl = $s; secret = $sec } | ConvertTo-Json -Compress; " ..
            "try { Invoke-RestMethod -Uri '%s' -Method Post -ContentType 'application/json' -Headers @{ 'X-Webhook-Secret' = $sec } -Body $body -TimeoutSec 10 } catch { Write-Host $_ }",
            u, s, sec, full_url
        )
    else
        ps_script = string.format(
            "$u = '%s'; $sec = '%s'; " ..
            "$body = @{ userId = $u; secret = $sec } | ConvertTo-Json -Compress; " ..
            "try { Invoke-RestMethod -Uri '%s' -Method Post -ContentType 'application/json' -Headers @{ 'X-Webhook-Secret' = $sec } -Body $body -TimeoutSec 10 } catch { Write-Host $_ }",
            u, sec, full_url
        )
    end

    run_hidden(ps_script)
end

-- Inicia o MediaMTX em background se existir
local function start_mediamtx()
    local mediamtx_exe = script_dir .. "mediamtx.exe"
    local config_file = script_dir .. "mediamtx.yml"
    
    local f = io.open(mediamtx_exe, "r")
    if f then
        f:close()
        print("[OBS Sync] Inicializando MediaMTX em segundo plano...")
        local cmd = string.format("if (-not (Get-Process 'mediamtx' -ErrorAction SilentlyContinue)) { Start-Process -FilePath '%s' -ArgumentList '%s' -WorkingDirectory '%s' -WindowStyle Hidden }", mediamtx_exe, config_file, script_dir)
        run_hidden(cmd)
    else
        print("[OBS Sync] mediamtx.exe não encontrado em " .. script_dir .. ". Execute install-relay.bat.")
    end
end

-- Encerra MediaMTX e Cloudflared
local function stop_all_processes()
    run_hidden("Stop-Process -Name 'cloudflared' -Force -ErrorAction SilentlyContinue; Stop-Process -Name 'mediamtx' -Force -ErrorAction SilentlyContinue")
end

-- Função de polling para capturar a URL do Cloudflare Tunnel
local function check_tunnel_ready()
    attempts = attempts + 1
    local f = io.open(log_file, "r")
    if f then
        local content = f:read("*a")
        f:close()

        -- Procura por https://*.trycloudflare.com no log
        local tunnel_url = content:match("(https://[%w%-]+%.trycloudflare%.com)")
        if tunnel_url then
            obs.timer_remove(check_tunnel_ready)
            tunnel_timer_active = false
            print("[OBS Sync] Túnel Cloudflare ativo: " .. tunnel_url)

            local hls_stream_url = string.format("%s/%s/index.m3u8", tunnel_url, stream_key)
            send_bot_webhook("/api/stream/start", {
                userId = discord_user_id,
                streamUrl = hls_stream_url,
                secret = webhook_secret
            })
            return
        end
    end

    if attempts >= max_attempts then
        obs.timer_remove(check_tunnel_ready)
        tunnel_timer_active = false
        print("[OBS Sync] Tempo limite excedido ao obter URL do túnel Cloudflare.")
    end
end

-- Inicia o Cloudflare Quick Tunnel ao começar a live
local function start_tunnel()
    local cloudflared_exe = script_dir .. "cloudflared.exe"
    local f = io.open(cloudflared_exe, "r")
    if not f then
        print("[OBS Sync] cloudflared.exe não encontrado em " .. script_dir .. ". Execute install-relay.bat.")
        return
    end
    f:close()

    -- Remove log anterior se existir
    os.remove(log_file)
    attempts = 0

    print("[OBS Sync] Iniciando Cloudflare Quick Tunnel...")
    local cmd = string.format("Start-Process -FilePath '%s' -ArgumentList 'tunnel --url http://localhost:8888 --logfile \"%s\"' -WindowStyle Hidden", cloudflared_exe, log_file)
    run_hidden(cmd)

    if not tunnel_timer_active then
        tunnel_timer_active = true
        obs.timer_add(check_tunnel_ready, 1000)
    end
end

-- Interceptador de eventos do OBS
local function on_event(event)
    if event == obs.OBS_FRONTEND_EVENT_STREAMING_STARTED then
        print("[OBS Sync] Transmissão iniciada no OBS!")
        start_tunnel()
    elseif event == obs.OBS_FRONTEND_EVENT_STREAMING_STOPPED then
        print("[OBS Sync] Transmissão finalizada no OBS.")
        if tunnel_timer_active then
            obs.timer_remove(check_tunnel_ready)
            tunnel_timer_active = false
        end
        run_hidden("Stop-Process -Name 'cloudflared' -Force -ErrorAction SilentlyContinue")
        send_bot_webhook("/api/stream/stop", {
            userId = discord_user_id,
            secret = webhook_secret
        })
    end
end

-- Metadados e Propriedades no menu do OBS
function script_description()
    return [[
<h2>📡 Discord Stream Sync (OBS Relay)</h2>
<p>Sincroniza automaticamente a transmissão do OBS com o Bot do Discord e cria um túnel HTTPS para o Player Web.</p>
<p><b>Como usar:</b></p>
<ol>
  <li>Preencha apenas o seu <b>ID do Discord</b> abaixo (a URL e a Chave Secreta já vêm pré-configuradas!).</li>
  <li>No OBS, configure a saída de transmissão para:
    <ul>
      <li><b>Servidor:</b> <code>rtmp://localhost:1935/live</code></li>
      <li><b>Chave:</b> <code>live</code></li>
    </ul>
  </li>
  <li>Clique em <b>Iniciar Transmissão</b>. O bot avisará a galera automaticamente no canal <b>#telamento</b>!</li>
</ol>
]]
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, "bot_url", DEFAULT_BOT_URL)
    obs.obs_data_set_default_string(settings, "webhook_secret", DEFAULT_WEBHOOK_SECRET)
    obs.obs_data_set_default_string(settings, "stream_key", DEFAULT_STREAM_KEY)
end

function script_properties()
    local props = obs.obs_properties_create()
    obs.obs_properties_add_text(props, "bot_url", "URL do Bot (Render)", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_text(props, "discord_user_id", "Seu ID do Discord", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_text(props, "webhook_secret", "Chave Secreta (OBS_WEBHOOK_SECRET)", obs.OBS_TEXT_PASSWORD)
    obs.obs_properties_add_text(props, "stream_key", "Chave do Stream no MediaMTX (padrão: live)", obs.OBS_TEXT_DEFAULT)
    return props
end

function script_update(settings)
    bot_url = obs.obs_data_get_string(settings, "bot_url")
    if bot_url == "" then bot_url = DEFAULT_BOT_URL end

    discord_user_id = obs.obs_data_get_string(settings, "discord_user_id")

    webhook_secret = obs.obs_data_get_string(settings, "webhook_secret")
    if webhook_secret == "" then webhook_secret = DEFAULT_WEBHOOK_SECRET end

    stream_key = obs.obs_data_get_string(settings, "stream_key")
    if stream_key == "" then stream_key = DEFAULT_STREAM_KEY end
end

function script_load(settings)
    script_dir = obs.obs_data_get_string(settings, "_script_dir")
    if script_dir == "" then
        -- Normaliza o caminho do diretório do script
        script_dir = debug.getinfo(1).source:match("@?(.*[\\/])") or ""
    end
    log_file = script_dir .. "cloudflared.log"

    obs.obs_frontend_add_event_callback(on_event)
    start_mediamtx()
    print("[OBS Sync] Script carregado com sucesso. Diretório: " .. script_dir)
end

function script_unload()
    if tunnel_timer_active then
        obs.timer_remove(check_tunnel_ready)
    end
    stop_all_processes()
    print("[OBS Sync] Script descarregado. Processos encerrados.")
end
