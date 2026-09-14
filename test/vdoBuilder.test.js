const assert = require('assert');
const { generateRoomId, buildPushUrl, buildViewUrl } = require('../src/utils/vdoBuilder');
const streamStore = require('../src/utils/streamStore');

console.log('=== TESTES DO BOT DISCORD + VDO.NINJA ===\n');

// 1. Validacao do Gerador de Sala
console.log('1. Testando gerador de ID unico da sala...');
const r1 = generateRoomId();
const r2 = generateRoomId();
assert(typeof r1 === 'string' && r1.length > 5);
assert.notStrictEqual(r1, r2);
console.log('   [OK Sala gerada:', r1);

// 2. Validacao dos Parametros do Transmissor
console.log('\n2. Testando URL do Transmissor...');
const pushUrl = buildPushUrl(r1);
const pushUrlObj = new URL(pushUrl);

assert.strictEqual(pushUrlObj.origin, 'https://vdo.ninja');
assert.strictEqual(pushUrlObj.searchParams.get('push'), r1);
assert.strictEqual(pushUrlObj.searchParams.has('screenshare'), true);
assert.strictEqual(pushUrlObj.searchParams.has('webcam'), false);
assert.strictEqual(pushUrlObj.searchParams.get('quality'), '0');
assert.strictEqual(pushUrlObj.searchParams.get('fps'), '60');
assert.strictEqual(pushUrlObj.searchParams.get('bitrate'), '9000');
assert.strictEqual(pushUrlObj.searchParams.get('prefervideocodec'), 'h264,vp8');
assert.strictEqual(pushUrlObj.searchParams.get('screensharecontenthint'), 'motion');
assert.strictEqual(pushUrlObj.searchParams.get('proaudio'), '1');
assert.strictEqual(pushUrlObj.searchParams.get('autostart'), '1');
console.log('   [OK] Push URL validada com sucesso!');

// 3. Validacao dos Parametros do Espectador
console.log('\n3. Testando URL do Espectador...');
const viewUrl = buildViewUrl(r1);
const viewUrlObj = new URL(viewUrl);

assert.strictEqual(viewUrlObj.origin, 'https://vdo.ninja');
assert.strictEqual(viewUrlObj.searchParams.get('view'), r1);
assert.strictEqual(viewUrlObj.searchParams.get('darkmode'), '1');
assert.strictEqual(viewUrlObj.searchParams.get('holdercolor'), '000000');
assert.strictEqual(viewUrlObj.searchParams.get('videocontrols'), '1');
assert.strictEqual(viewUrlObj.searchParams.get('codec'), 'h264,vp8');
assert.strictEqual(viewUrlObj.searchParams.get('scale'), '100');
assert.strictEqual(viewUrlObj.searchParams.get('autoplay'), '1');
assert.strictEqual(viewUrlObj.searchParams.has('transparent'), false);
assert.strictEqual(viewUrlObj.searchParams.has('cleanoutput'), false);

const viewProxyUrl = buildViewUrl(r1, { proxy: true });
const viewProxyUrlObj = new URL(viewProxyUrl);
assert.strictEqual(viewProxyUrlObj.origin, 'https://proxy.vdo.ninja');
assert.strictEqual(viewProxyUrlObj.searchParams.has('proxy'), true);
console.log('   [OK] Ciclo de vida do View URL (Normal e Proxy) validado com sucesso!');

// 4. Validacao do Gerenciador em Memoria
console.log('\n4. Testando StreamStore...');
const testUserId = '123456789012345678';
const testData = {
  roomId: r1,
  channelId: '987654321',
  messageId: '1122334455',
  voiceChannelId: '5566778899',
  voiceChannelName: 'Voz e Jogos',
  pushUrl,
  viewUrl
};

streamStore.setStream(testUserId, testData);
assert.strictEqual(streamStore.hasActiveStream(testUserId), true);
const retrieved = streamStore.getStream(testUserId);
assert.strictEqual(retrieved.roomId, r1);
assert(retrieved.startedAt instanceof Date);

streamStore.deleteStream(testUserId);
assert.strictEqual(streamStore.hasActiveStream(testUserId), false);
assert.strictEqual(streamStore.getStream(testUserId), null);
console.log('   [OK] StreamStore validado!');

console.log('\n=======================================');
console.log('  TODOS OS TESTES PASSARAM COM SUCESSO! ');
console.log('========================================\n');