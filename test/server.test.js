const assert = require('assert');
const http = require('http');
const { createServerInstance } = require('../src/server');
const streamStore = require('../src/utils/streamStore');

console.log('=== TESTES DO SERVIDOR HTTP E WEBHOOKS (TASK 3) ===\n');

async function makeRequest(port, options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, host: '127.0.0.1', ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

(async () => {
  const TEST_PORT = 3987;
  const TEST_SECRET = 'secret_test_123';
  let startCalledWith = null;
  let stopCalledWith = null;

  const server = createServerInstance({
    secret: TEST_SECRET,
    onStreamStart: async (payload) => {
      startCalledWith = payload;
      streamStore.setStream(payload.userId, {
        streamId: payload.streamId || 'stream_abc',
        streamUrl: payload.streamUrl,
        userId: payload.userId
      });
      return { success: true };
    },
    onStreamStop: async (payload) => {
      stopCalledWith = payload;
      streamStore.deleteStream(payload.userId);
      return { success: true };
    }
  });

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  try {
    // 1. Health check & Ping
    console.log('1. Testando /health e /healthz...');
    const health = await makeRequest(TEST_PORT, { path: '/health', method: 'GET' });
    assert.strictEqual(health.statusCode, 200);
    assert.strictEqual(health.json.status, 'ok');

    const healthz = await makeRequest(TEST_PORT, { path: '/healthz', method: 'GET' });
    assert.strictEqual(healthz.statusCode, 200);
    assert.strictEqual(healthz.json.status, 'ok');

    const ping = await makeRequest(TEST_PORT, { path: '/ping', method: 'GET' });
    assert.strictEqual(ping.statusCode, 200);
    assert.strictEqual(ping.json.status, 'ok');
    console.log('   [OK] /health, /healthz e /ping responderam 200.');

    // 2. Autenticação 401 Unauthorized
    console.log('\n2. Testando autenticação com secret inválido...');
    const unauth = await makeRequest(TEST_PORT, {
      path: '/api/stream/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer wrong_secret' }
    }, { userId: 'user_1', streamUrl: 'https://test.trycloudflare.com' });
    assert.strictEqual(unauth.statusCode, 401);
    console.log('   [OK] Retornou 401 Unauthorized.');

    // 3. Validação 400 Bad Request
    console.log('\n3. Testando payload incompleto...');
    const badReq = await makeRequest(TEST_PORT, {
      path: '/api/stream/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': TEST_SECRET }
    }, { userId: 'user_1' }); // falta streamUrl
    assert.strictEqual(badReq.statusCode, 400);
    console.log('   [OK] Retornou 400 Bad Request.');

    // 4. Início de stream com sucesso
    console.log('\n4. Testando POST /api/stream/start com sucesso...');
    const startRes = await makeRequest(TEST_PORT, {
      path: '/api/stream/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': TEST_SECRET }
    }, { userId: 'user_1', streamUrl: 'https://live-tunnel.trycloudflare.com/live/index.m3u8' });
    assert.strictEqual(startRes.statusCode, 200);
    assert.strictEqual(startRes.json.success, true);
    assert.ok(startCalledWith);
    assert.strictEqual(startCalledWith.userId, 'user_1');
    assert.strictEqual(streamStore.hasActiveStream('user_1'), true);
    console.log('   [OK] Stream iniciada com sucesso.');

    // 5. Encerramento de stream com sucesso
    console.log('\n5. Testando POST /api/stream/stop com sucesso...');
    const stopRes = await makeRequest(TEST_PORT, {
      path: '/api/stream/stop',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': TEST_SECRET }
    }, { userId: 'user_1' });
    assert.strictEqual(stopRes.statusCode, 200);
    assert.strictEqual(stopRes.json.success, true);
    assert.ok(stopCalledWith);
    assert.strictEqual(stopCalledWith.userId, 'user_1');
    assert.strictEqual(streamStore.hasActiveStream('user_1'), false);
    console.log('   [OK] Stream encerrada com sucesso.');

    console.log('\n=======================================');
    console.log('  TODOS OS TESTES DO SERVIDOR PASSARAM! ');
    console.log('========================================\n');
  } finally {
    server.close();
  }
})();
