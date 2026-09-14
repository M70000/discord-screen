const { Events } = require('discord.js');
const streamStore = require('../utils/streamStore');
const { endStreamSession } = require('../utils/streamManager');

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,

  /**
   * Disparado quando o estado de voz de um membro é alterado.
   * Encerra a transmissão automaticamente se o usuário transmissor sair do canal de voz.
   *
   * @param {import('discord.js').VoiceState} oldState Estado de voz anterior
   * @param {import('discord.js').VoiceState} newState Novo estado de voz
   * @param {import('discord.js').Client} client Cliente Discord
   */
  async execute(oldState, newState, client) {
    // Se o canal não mudou (usuário apenas mutou, desmutou, ligou câmera ou transmitiu pelo Discord), ignora
    if (oldState.channelId === newState.channelId) {
      return;
    }

    const userId = newState.id || oldState.id;
    if (!userId) return;

    // Verifica se esse usuário possui uma transmissão ativa registrada
    const activeStream = streamStore.getStream(userId);
    if (!activeStream) return;

    // Se o usuário não está mais no canal onde iniciou a transmissão
    // (desconectou completamente da call: newState.channelId === null, ou mudou de sala de voz)
    if (newState.channelId !== activeStream.voiceChannelId) {
      console.log(`[AutoEndStream] Usuário ${userId} saiu do canal de voz "${activeStream.voiceChannelName}". Finalizando transmissão...`);
      const discordClient = client || oldState.client || newState.client;
      await endStreamSession(discordClient, userId, { reason: 'voice_leave' });
    }
  }
};
