const assert = require('assert');
const streamStore = require('../src/utils/streamStore');
const {
  findAnnouncementChannel,
  startStreamSession,
  endStreamSession,
  updateStreamThumbnail
} = require('../src/utils/streamManager');

console.log('=== TESTES DO STREAMMANAGER (TASK 4) ===\n');

// Mock helpers para Discord.js
function createMockClient() {
  const sentMessages = [];
  const editedMessages = [];

  const mockChannel = {
    id: 'telamento_channel_123',
    name: 'telamento',
    isTextBased: () => true,
    send: async (payload) => {
      const msg = {
        id: `msg_${Date.now()}_${Math.random()}`,
        channelId: 'telamento_channel_123',
        payload,
        embeds: payload.embeds || [],
        components: payload.components || [],
        edit: async (newPayload) => {
          msg.payload = newPayload;
          if (newPayload.embeds) msg.embeds = newPayload.embeds;
          editedMessages.push(msg);
          return msg;
        }
      };
      sentMessages.push(msg);
      return msg;
    },
    messages: {
      fetch: async (id) => sentMessages.find(m => m.id === id) || null
    }
  };

  const mockMember = {
    id: 'streamer_user_1',
    displayName: 'GamerPro',
    nickname: null,
    setNickname: async (newNick) => {
      mockMember.nickname = newNick;
    },
    voice: {
      channel: {
        id: 'voice_room_1',
        name: 'Geral Voz'
      }
    },
    roles: {
      highest: { comparePositionTo: () => -1 }
    }
  };

  const mockGuild = {
    id: 'guild_999',
    ownerId: 'owner_999',
    channels: {
      cache: new Map([['telamento_channel_123', mockChannel]]),
      fetch: async (id) => id === mockChannel.id ? mockChannel : null
    },
    members: {
      me: {
        permissions: { has: () => true },
        roles: { highest: { comparePositionTo: () => 1 } }
      },
      fetch: async (id) => id === mockMember.id ? mockMember : null
    }
  };

  const client = {
    guilds: {
      cache: new Map([['guild_999', mockGuild]]),
      fetch: async (id) => id === mockGuild.id ? mockGuild : null
    },
    channels: {
      fetch: async (id) => id === mockChannel.id ? mockChannel : null
    },
    sentMessages,
    editedMessages,
    mockMember,
    mockChannel
  };

  return client;
}

(async () => {
  streamStore.clear();
  const client = createMockClient();

  // 1. Testando busca do canal #telamento
  console.log('1. Testando findAnnouncementChannel...');
  const guild = client.guilds.cache.get('guild_999');
  const channel = await findAnnouncementChannel(guild);
  assert.ok(channel, 'Deveria encontrar o canal #telamento');
  assert.strictEqual(channel.name, 'telamento');
  console.log('   [OK] Canal #telamento localizado.');

  // 2. Iniciar sessão de stream
  console.log('\n2. Testando startStreamSession...');
  const startResult = await startStreamSession(client, {
    userId: 'streamer_user_1',
    streamUrl: 'https://alfa-beta.trycloudflare.com/live/index.m3u8',
    streamId: 'live_test_456'
  });

  assert.strictEqual(startResult.success, true);
  assert.strictEqual(streamStore.hasActiveStream('streamer_user_1'), true);
  assert.strictEqual(client.sentMessages.length, 1);
  assert.strictEqual(client.mockMember.nickname, 'GamerPro | 🔴 LIVE');
  console.log('   [OK] Sessão iniciada, mensagem enviada e apelido alterado.');

  // 3. Encerrar sessão de stream
  console.log('\n3. Testando endStreamSession...');
  const endResult = await endStreamSession(client, 'streamer_user_1', { reason: 'manual' });
  assert.strictEqual(endResult.success, true);
  assert.strictEqual(streamStore.hasActiveStream('streamer_user_1'), false);
  assert.strictEqual(client.editedMessages.length, 1);
  assert.strictEqual(client.mockMember.nickname, null, 'Apelido deveria ser restaurado');
  console.log('   [OK] Sessão encerrada, mensagem editada e apelido restaurado.');

  // 4. Testando updateStreamThumbnail
  console.log('\n4. Testando updateStreamThumbnail...');
  streamStore.setStream('streamer_user_1', {
    streamId: 'live_test_456',
    channelId: 'telamento_channel_123',
    messageId: client.sentMessages[0].id
  });
  await updateStreamThumbnail(client, 'streamer_user_1');
  assert.strictEqual(client.editedMessages.length >= 2, true);
  console.log('   [OK] updateStreamThumbnail editou a mensagem com sucesso.');

  console.log('\n=======================================');
  console.log('  TESTES DO STREAMMANAGER PASSARAM!     ');
  console.log('========================================\n');
})();
