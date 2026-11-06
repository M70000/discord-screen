const http = require('http');
const fs = require('fs');
const path = require('path');
const streamStore = require('./utils/streamStore');

/**
 * Lê o corpo da requisição HTTP como texto JSON.
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Proteção contra payloads gigantescos (> 1MB)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Envia uma resposta JSON padronizada.
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret'
  });
  res.end(JSON.stringify(data));
}

/**
 * Valida a autenticação da requisição comparando com o secret configurado.
 */
function isAuthorized(req, body, configuredSecret) {
  if (!configuredSecret) {
    return true; // Se nenhum secret foi definido, permite em desenvolvimento
  }

  const check = (token) => {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    const cleanConfig = configuredSecret.trim();
    if (cleanToken === cleanConfig) return true;
    // Permite caso o secret tenha sido colado parcialmente (pelo menos 20 caracteres coincidentes)
    if (cleanToken.length >= 20 && cleanConfig.startsWith(cleanToken)) return true;
    if (cleanConfig.length >= 20 && cleanToken.startsWith(cleanConfig)) return true;
    return false;
  };

  // 1. Header Authorization: Bearer <secret>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    if (check(authHeader.slice(7))) return true;
  }

  // 2. Header X-Webhook-Secret
  const customHeader = req.headers['x-webhook-secret'];
  if (customHeader && check(customHeader)) {
    return true;
  }

  // 3. Campo secret no corpo JSON
  if (body && check(body.secret)) {
    return true;
  }

  return false;
}

/**
 * Cria a instância do servidor HTTP.
 * @param {Object} [options]
 * @param {string} [options.secret] Chave secreta de autenticação do webhook
 * @param {Function} [options.onStreamStart] Callback chamado ao iniciar live
 * @param {Function} [options.onStreamStop] Callback chamado ao encerrar live
 * @returns {http.Server}
 */
function createServerInstance(options = {}) {
  const secret = options.secret || process.env.OBS_WEBHOOK_SECRET;
  const onStreamStart = options.onStreamStart || (async () => {});
  const onStreamStop = options.onStreamStop || (async () => {});

  const publicDir = path.join(__dirname, 'public');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // CORS pre-flight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret'
      });
      return res.end();
    }

    // 1. Health check & Ping (suporta /health, /healthz, /ping, /api/health e /)
    if (method === 'GET' && (
      pathname === '/health' ||
      pathname === '/healthz' ||
      pathname === '/ping' ||
      pathname === '/api/health' ||
      pathname === '/api/healthz' ||
      pathname === '/'
    )) {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'discord-screen-relay',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        activeStreams: streamStore.getAllStreams().length
      });
    }

    // 2. Webhook: Início de Stream
    if (method === 'POST' && pathname === '/api/stream/start') {
      let body;
      try {
        body = await parseRequestBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }

      if (!isAuthorized(req, body, secret)) {
        return sendJson(res, 401, { error: 'Unauthorized: Secret inválido ou ausente' });
      }

      const { userId, streamUrl, streamId } = body;
      if (!userId || typeof userId !== 'string' || !streamUrl || typeof streamUrl !== 'string') {
        return sendJson(res, 400, { error: 'Campos "userId" e "streamUrl" são obrigatórios' });
      }

      try {
        const finalStreamId = streamId || `live_${userId}_${Date.now().toString(36)}`;
        const result = await onStreamStart({
          userId,
          streamUrl,
          streamId: finalStreamId
        });
        return sendJson(res, 200, {
          success: true,
          streamId: finalStreamId,
          streamUrl,
          ...result
        });
      } catch (err) {
        console.error('[HTTP API] Erro ao processar /api/stream/start:', err);
        return sendJson(res, 500, { error: err.message || 'Erro interno ao iniciar stream' });
      }
    }

    // 3. Webhook: Fim de Stream
    if (method === 'POST' && pathname === '/api/stream/stop') {
      let body;
      try {
        body = await parseRequestBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }

      if (!isAuthorized(req, body, secret)) {
        return sendJson(res, 401, { error: 'Unauthorized: Secret inválido ou ausente' });
      }

      const { userId } = body;
      if (!userId || typeof userId !== 'string') {
        return sendJson(res, 400, { error: 'Campo "userId" é obrigatório' });
      }

      try {
        const result = await onStreamStop({ userId });
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        console.error('[HTTP API] Erro ao processar /api/stream/stop:', err);
        return sendJson(res, 500, { error: err.message || 'Erro interno ao encerrar stream' });
      }
    }

    // 4. Download do instalador e pacote do Relay
    if (method === 'GET' && (pathname === '/download/relay.zip' || pathname === '/download/installer.zip')) {
      const zipPath = path.join(__dirname, '..', 'relay.zip');
      if (fs.existsSync(zipPath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="relay.zip"');
        res.setHeader('Content-Type', 'application/zip');
        return res.writeHead(200).end(fs.readFileSync(zipPath));
      }
    }

    if (method === 'GET' && (pathname === '/download/installer' || pathname === '/download/install-relay.bat')) {
      const installerPath = path.join(__dirname, '..', 'relay', 'install-relay.bat');
      if (fs.existsSync(installerPath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="install-relay.bat"');
        res.setHeader('Content-Type', 'application/x-bat');
        return res.writeHead(200).end(fs.readFileSync(installerPath));
      }
    }

    // 5. Status de Stream
    if (method === 'GET' && pathname.startsWith('/api/stream/status/')) {
      const id = pathname.replace('/api/stream/status/', '').trim();
      const stream = streamStore.getStreamById(id) || streamStore.getStream(id);
      return sendJson(res, 200, {
        active: Boolean(stream),
        stream: stream || null
      });
    }

    // 6. Visualizador Web (Player / Watch)
    if (method === 'GET' && (pathname.startsWith('/watch/') || pathname.startsWith('/live/'))) {
      const id = pathname.replace(/^\/(watch|live)\//, '').trim();
      const stream = streamStore.getStreamById(id) || streamStore.getStream(id);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      if (!stream) {
        // Tenta servir offline.html
        const offlinePath = path.join(publicDir, 'offline.html');
        if (fs.existsSync(offlinePath)) {
          return res.writeHead(200).end(fs.readFileSync(offlinePath));
        }
        return res.writeHead(200).end(`
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><title>Transmissão Encerrada</title></head>
            <body style="background:#0f1117;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
              <h1>📺 Transmissão Offline</h1>
              <p>Esta transmissão foi encerrada ou ainda não foi iniciada.</p>
            </body>
          </html>
        `);
      }

      // Serve player.html com a URL injetada no script e templates
      const playerPath = path.join(publicDir, 'player.html');
      if (fs.existsSync(playerPath)) {
        let html = fs.readFileSync(playerPath, 'utf8');
        const injection = `<script>window.__STREAM_SRC__ = ${JSON.stringify(stream.streamUrl)}; window.__STREAMER_NAME__ = ${JSON.stringify(stream.voiceChannelName || stream.userId)};</script>`;
        html = html.replace('<head>', `<head>\n  ${injection}`);
        html = html.replaceAll('{{STREAM_SRC}}', stream.streamUrl);
        html = html.replaceAll('{{STREAMER_NAME}}', stream.voiceChannelName || stream.userId);
        return res.writeHead(200).end(html);
      }

      // Fallback básico caso player.html ainda não tenha sido criado
      return res.writeHead(200).end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Assistir Transmissão</title>
            <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
          </head>
          <body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
            <video id="video" controls autoplay playsinline style="max-width:100%;max-height:100%;"></video>
            <script>
              const src = ${JSON.stringify(stream.streamUrl)};
              const video = document.getElementById('video');
              if (Hls.isSupported()) {
                const hls = new Hls({ lowLatencyMode: true });
                hls.loadSource(src);
                hls.attachMedia(video);
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
              }
            </script>
          </body>
        </html>
      `);
    }

    // 404 para outras rotas
    sendJson(res, 404, { error: 'Not found' });
  });

  return server;
}

/**
 * Inicia o servidor HTTP em uma porta especificada.
 */
function startServer(options = {}) {
  const port = options.port || process.env.PORT || 3000;
  const server = createServerInstance(options);

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`[HTTP Server] Servidor escutando na porta ${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = {
  createServerInstance,
  startServer
};
