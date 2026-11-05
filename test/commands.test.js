const assert = require('assert');
const streamStore = require('../src/utils/streamStore');
const streamCommand = require('../src/commands/stream');
const endstreamCommand = require('../src/commands/endstream');

console.log('=== TESTES DOS SLASH COMMANDS (TASK 5) ===\n');

function createMockInteraction(userId, isLive = false) {
  let replyData = null;
  let followUpData = null;
  let deferred = false;

  const interaction = {
    user: { id: userId, tag: 'TestUser#0001' },
    member: {
      displayName: 'TestUser',
      voice: { channel: { id: 'voice_1', name: 'Call de Jogos' } }
    },
    client: {
      guilds: { cache: new Map() },
      channels: { cache: new Map() }
    },
    deferReply: async (opts) => { deferred = true; return opts; },
    reply: async (data) => { replyData = data; return data; },
    editReply: async (data) => { replyData = data; return data; },
    followUp: async (data) => { followUpData = data; return data; },
    getReplyData: () => replyData,
    getFollowUpData: () => followUpData
  };

  return interaction;
}

(async () => {
  streamStore.clear();

  // 1. Cenário Offline: usuário digita /stream sem ter iniciado no OBS
  console.log('1. Testando /stream quando o usuário está offline no OBS...');
  const offlineInteraction = createMockInteraction('user_offline_1');
  await streamCommand.execute(offlineInteraction);
  const offlineReply = offlineInteraction.getReplyData();

  assert.ok(offlineReply, 'Deveria responder à interação');
  assert.ok(offlineReply.embeds && offlineReply.embeds.length > 0, 'Deveria retornar embeds com o guia do OBS');
  const embedDesc = offlineReply.embeds[0].data.description;
  assert.ok(embedDesc.includes('rtmp://localhost:1935/live'), 'Deveria conter a URL RTMP local no guia');

  // Valida que todos os botões com URL usam ButtonStyle.Link (style 5 no Discord)
  if (offlineReply.components) {
    for (const row of offlineReply.components) {
      for (const btn of row.components) {
        if (btn.data.url) {
          assert.strictEqual(btn.data.style, 5, `Botão "${btn.data.label}" com URL deve usar ButtonStyle.Link (5)`);
        }
      }
    }
  }
  console.log('   [OK] /stream respondeu com o guia de configuração do OBS e botões válidos.');

  // 2. Cenário Online: usuário já possui live ativa
  console.log('\n2. Testando /stream quando o usuário já está ao vivo...');
  const userId = 'user_online_1';
  streamStore.setStream(userId, {
    streamId: 'live_active_123',
    userId,
    streamUrl: 'https://test-tunnel.trycloudflare.com/live/index.m3u8',
    watchUrl: 'http://localhost:3000/watch/live_active_123'
  });

  const onlineInteraction = createMockInteraction(userId);
  await streamCommand.execute(onlineInteraction);
  const onlineReply = onlineInteraction.getReplyData();

  assert.ok(onlineReply.embeds && onlineReply.embeds.length > 0);
  assert.ok(onlineReply.components && onlineReply.components.length > 0);
  console.log('   [OK] /stream retornou os botões e link da transmissão ativa.');

  // 3. Testando /endstream
  console.log('\n3. Testando /endstream...');
  const endInteraction = createMockInteraction(userId);
  await endstreamCommand.execute(endInteraction);
  assert.strictEqual(streamStore.hasActiveStream(userId), false, 'A live deveria ter sido encerrada');
  console.log('   [OK] /endstream encerrou a sessão com sucesso.');

  console.log('\n=======================================');
  console.log('  TESTES DOS COMANDOS PASSARAM!         ');
  console.log('========================================\n');
})();
