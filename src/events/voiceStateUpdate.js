const { Events } = require('discord.js');
const streamStore = require('../utils/streamStore');
const { endStreamSession, canManageMember } = require('../utils/streamManager');

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,

  /**
   * Disparado quando o estado de voz de um membro é alterado.
   * - Encerra a transmissão automaticamente se o usuário sair da call onde estava transmitindo.
   * - Associa a transmissão à call caso o usuário tenha iniciado no OBS antes de entrar no canal de voz.
   *
   * @param {import('discord.js').VoiceState} oldState Estado de voz anterior
   * @param {import('discord.js').VoiceState} newState Novo estado de voz
   * @param {import('discord.js').Client} client Cliente Discord
   */
  async execute(oldState, newState, client) {
    if (oldState.channelId === newState.channelId) {
      return;
    }

    const userId = newState.id || oldState.id;
    if (!userId) return;

    const activeStream = streamStore.getStream(userId);
    if (!activeStream) return;

    const discordClient = client || oldState.client || newState.client;

    // Cenário 1: Streamer já estava em uma sala de voz e saiu ou mudou de sala
    if (activeStream.voiceChannelId) {
      if (newState.channelId !== activeStream.voiceChannelId) {
        console.log(`[VoiceState] Streamer ${userId} desconectou do canal de voz. Encerrando sessão...`);
        await endStreamSession(discordClient, userId, { reason: 'voice_leave' });
      }
      return;
    }

    // Cenário 2: Streamer iniciou no OBS antes de entrar na call, e agora acabou de entrar
    if (!activeStream.voiceChannelId && newState.channelId && newState.channel) {
      activeStream.voiceChannelId = newState.channelId;
      activeStream.voiceChannelName = newState.channel.name;

      const member = newState.member;
      const guild = newState.guild;
      if (member && guild) {
        const isManageable = await canManageMember(guild, member);
        if (isManageable && !activeStream.changedNickname) {
          try {
            const suffix = ' | 🔴 LIVE';
            activeStream.originalNickname = member.nickname ?? null;
            const maxBaseLength = 32 - suffix.length;
            const cleanBaseName = member.displayName.replace(/\s*\|\s*🔴\s*LIVE$/i, '');
            const baseName = cleanBaseName.slice(0, maxBaseLength).trim();
            await member.setNickname(`${baseName}${suffix}`);
            activeStream.changedNickname = true;
            console.log(`[VoiceState] Apelido de ${member.displayName} atualizado ao entrar na call.`);
          } catch (e) {
            console.warn('[VoiceState] Não foi possível atualizar apelido:', e.message);
          }
        }
      }
    }
  }
};
