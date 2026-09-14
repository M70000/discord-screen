const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const streamStore = require('./streamStore');

/**
 * Verifica com segurança se o bot tem permissão e hierarquia para alterar o apelido de um membro.
 * Evita o erro DiscordjsError [GuildUncachedMe] resolvendo o bot (`guild.members.me`) de forma resiliente.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<boolean>}
 */
async function canManageMember(guild, member) {
  if (!guild || !member) return false;
  if (member.id === guild.ownerId) return false;
  if (member.id === guild.client.user?.id) return false;

  try {
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me) return false;

    const hasPermission = me.permissions.has(PermissionFlagsBits.ManageNicknames);
    if (!hasPermission) return false;

    // O cargo mais alto do bot deve estar acima do cargo mais alto do membro
    const botHighestRole = me.roles?.highest;
    const memberHighestRole = member.roles?.highest;
    if (!botHighestRole || !memberHighestRole) return false;

    return botHighestRole.comparePositionTo(memberHighestRole) > 0;
  } catch (err) {
    console.warn('[Nickname] Aviso ao verificar permissões de gerenciamento do membro:', err.message);
    return false;
  }
}

/**
 * Encerra uma transmissão ativa, atualizando a mensagem pública no Discord
 * e removendo os dados da memória.
 *
 * @param {import('discord.js').Client} client Cliente Discord
 * @param {string} userId ID do usuário transmissor
 * @param {Object} [options] Opções adicionais
 * @param {'manual'|'voice_leave'|'superseded'} [options.reason='manual'] Motivo do encerramento
 * @returns {Promise<{ success: boolean, activeStream?: Object }>}
 */
async function endStreamSession(client, userId, options = {}) {
  const reason = options.reason || 'manual';
  const activeStream = streamStore.getStream(userId);

  if (!activeStream) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  // Remove do armazenamento imediatamente para evitar condições de corrida
  streamStore.deleteStream(userId);

  // Determina o texto de rodapé conforme o motivo
  let footerText = 'Sessão encerrada pelo transmissor.';
  if (reason === 'voice_leave') {
    footerText = 'Sessão encerrada automaticamente (transmissor saiu da call).';
  } else if (reason === 'superseded') {
    footerText = 'Sessão anterior encerrada (nova transmissão iniciada).';
  }

  // Tenta atualizar a mensagem pública original para indicar encerramento e desativar botões
  try {
    const channel = await client.channels.fetch(activeStream.channelId).catch(() => null);
    if (channel) {
      const publicMessage = await channel.messages.fetch(activeStream.messageId).catch(() => null);
      if (publicMessage) {
        const startedTimestamp = activeStream.startedAt
          ? Math.floor(new Date(activeStream.startedAt).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        const endedEmbed = new EmbedBuilder()
          .setColor(0xED4245) // Vermelho Discord
          .setTitle('⏹️ Transmissão de Tela Encerrada')
          .setDescription(`A transmissão de <@${userId}> no canal **[${activeStream.voiceChannelName}]** foi finalizada.`)
          .addFields(
            {
              name: '🕒 Início',
              value: `<t:${startedTimestamp}:R>`,
              inline: true
            },
            {
              name: '📊 Status',
              value: '`Encerrada`',
              inline: true
            }
          )
          .setFooter({ text: footerText })
          .setTimestamp();

        // Atualiza a mensagem removendo os botões interativos
        await publicMessage.edit({
          embeds: [endedEmbed],
          components: []
        });
      }
    }
  } catch (error) {
    console.warn(`[StreamManager] Não foi possível atualizar a mensagem pública da stream de ${userId}:`, error.message);
  }

  // Restaura o apelido original do membro, caso tenha sido alterado
  if (activeStream.guildId && activeStream.changedNickname) {
    try {
      const guild = await client.guilds.fetch(activeStream.guildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        const isManageable = await canManageMember(guild, member);
        if (member && isManageable) {
          await member.setNickname(activeStream.originalNickname ?? null);
          console.log(`[Nickname] Apelido de ${member.user?.tag || userId} restaurado.`);
        }
      }
    } catch (error) {
      console.warn(`[Nickname] Não foi possível restaurar apelido do usuário ${userId}:`, error.message);
    }
  }

  return { success: true, activeStream };
}

module.exports = {
  canManageMember,
  endStreamSession
};
