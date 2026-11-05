const assert = require('assert');
const streamStore = require('../src/utils/streamStore');

console.log('=== TESTES DO STREAMSTORE (TASK 1) ===\n');

// 1. Inserção e busca por userId e streamId
const userId = 'user_12345';
const streamData = {
  streamId: 'live_test_999',
  userId,
  streamUrl: 'https://test-tunnel.trycloudflare.com/live/index.m3u8',
  channelId: 'telamento_channel_id',
  messageId: 'discord_msg_777',
  voiceChannelId: 'voice_123',
  voiceChannelName: 'Chamada 1'
};

streamStore.setStream(userId, streamData);
assert.strictEqual(streamStore.hasActiveStream(userId), true, 'Deveria ter stream ativa para o userId');

const retrieved = streamStore.getStream(userId);
assert.ok(retrieved, 'Deveria retornar a stream');
assert.strictEqual(retrieved.streamId, 'live_test_999');
assert.strictEqual(retrieved.streamUrl, streamData.streamUrl);
assert.ok(retrieved.startedAt instanceof Date, 'startedAt deve ser uma instância de Date');

// 2. Busca por streamId
const byStreamId = streamStore.getStreamById('live_test_999');
assert.ok(byStreamId, 'Deveria encontrar a stream pelo streamId');
assert.strictEqual(byStreamId.userId, userId);

// 3. Listagem de todas as streams
const all = streamStore.getAllStreams();
assert.ok(Array.isArray(all), 'getAllStreams deve retornar um Array');
assert.strictEqual(all.length, 1);
assert.strictEqual(all[0].streamId, 'live_test_999');

// 4. Deleção e limpeza dos índices
const deleted = streamStore.deleteStream(userId);
assert.strictEqual(deleted, true, 'deleteStream deve retornar true');
assert.strictEqual(streamStore.hasActiveStream(userId), false);
assert.strictEqual(streamStore.getStream(userId), null);
assert.strictEqual(streamStore.getStreamById('live_test_999'), null);
assert.strictEqual(streamStore.getAllStreams().length, 0);

console.log('Task 1 tests passed com sucesso!\n');
