const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const streamStore = require('./streamStore');

/**
 * Verifica com segurança se o bot tem permissão e hierarquia para alterar o apelido de um membro.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<boolean>}
 */
async function canManageMember(guild, member) {
  if (!guild || !member) return false;
  if (member.id === guild.ownerId) return false;
  if (member.id === guild.client?.user?.id) return false;

  try {
    const me = guild.members?.me || (guild.members?.fetchMe ? await guild.members.fetchMe().catch(() => null) : null);
    if (!me) return false;

    const hasPermission = me.permissions?.has(PermissionFlagsBits.ManageNicknames);
    if (!hasPermission) return false;

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
 * Localiza o canal de texto de anúncios (padrão #telamento).
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextBasedChannel|null>}
 */
async function findAnnouncementChannel(guild) {
  if (!guild) return null;

  // 1. Busca por ID configurado em variável de ambiente
  if (process.env.ANNOUNCEMENT_CHANNEL_ID) {
    const channelById = guild.channels?.cache?.get(process.env.ANNOUNCEMENT_CHANNEL_ID)
      || (guild.channels?.fetch ? await guild.channels.fetch(process.env.ANNOUNCEMENT_CHANNEL_ID).catch(() => null) : null);
    if (channelById && typeof channelById.isTextBased === 'function' && channelById.isTextBased()) {
      return channelById;
    }
  }

  // 2. Busca pelo nome do canal (padrão 'telamento')
  const targetName = (process.env.ANNOUNCEMENT_CHANNEL_NAME || 'telamento').toLowerCase();
  if (guild.channels?.cache) {
    for (const channel of guild.channels.cache.values()) {
      if (channel && channel.name && channel.name.toLowerCase() === targetName) {
        if (typeof channel.isTextBased === 'function' && channel.isTextBased()) {
          return channel;
        }
      }
    }
  }

  // 3. Fallback: primeiro canal de texto onde o bot tem permissão de escrita
  if (guild.channels?.cache) {
    for (const channel of guild.channels.cache.values()) {
      if (typeof channel.isTextBased === 'function' && channel.isTextBased()) {
        return channel;
      }
    }
  }

  return null;
}

/**
 * Localiza o membro e o servidor Discord pelo ID do usuário.
 * @param {import('discord.js').Client} client
 * @param {string} userId
 * @param {string} [guildId]
 * @returns {Promise<{ guild: import('discord.js').Guild, member: import('discord.js').GuildMember }|null>}
 */
async function resolveGuildAndMember(client, userId, guildId) {
  if (!client) return null;

  if (guildId && client.guilds?.cache?.has(guildId)) {
    const guild = client.guilds.cache.get(guildId) || (client.guilds?.fetch ? await client.guilds.fetch(guildId).catch(() => null) : null);
    if (guild) {
      const member = guild.members?.cache?.get(userId) || (guild.members?.fetch ? await guild.members.fetch(userId).catch(() => null) : null);
      if (member) return { guild, member };
    }
  }

  if (client.guilds?.cache) {
    for (const guild of client.guilds.cache.values()) {
      try {
        const member = guild.members?.cache?.get(userId) || (guild.members?.fetch ? await guild.members.fetch(userId).catch(() => null) : null);
        if (member) {
          return { guild, member };
        }
      } catch (e) {}
    }
  }

  return null;
}

/**
 * Inicia uma nova sessão de transmissão no Discord.
 * @param {import('discord.js').Client} client
 * @param {Object} streamData
 * @param {string} streamData.userId
 * @param {string} streamData.streamUrl
 * @param {string} [streamData.streamId]
 * @param {string} [streamData.guildId]
 */
async function startStreamSession(client, streamData) {
  const { userId, streamUrl, streamId, guildId } = streamData;
  const finalStreamId = streamId || `live_${userId}_${Date.now().toString(36)}`;

  // Se já havia uma transmissão ativa para este usuário, encerra a anterior
  if (streamStore.hasActiveStream(userId)) {
    await endStreamSession(client, userId, { reason: 'superseded' });
  }

  const resolved = await resolveGuildAndMember(client, userId, guildId);
  const guild = resolved?.guild || null;
  const member = resolved?.member || null;

  let originalNickname = null;
  let changedNickname = false;
  let voiceChannelId = null;
  let voiceChannelName = 'Chamada';

  if (member && guild) {
    voiceChannelId = member.voice?.channel?.id || null;
    voiceChannelName = member.voice?.channel?.name || 'Voz';

    // Atualização de apelido para "Nome | 🔴 LIVE"
    const suffix = ' | 🔴 LIVE';
    const isManageable = await canManageMember(guild, member);
    if (isManageable) {
      try {
        originalNickname = member.nickname ?? null;
        const maxBaseLength = 32 - suffix.length;
        const cleanBaseName = member.displayName.replace(/\s*\|\s*🔴\s*LIVE$/i, '');
        const baseName = cleanBaseName.slice(0, maxBaseLength).trim();
        await member.setNickname(`${baseName}${suffix}`);
        changedNickname = true;
        console.log(`[Nickname] Apelido de ${member.displayName} alterado para "${baseName}${suffix}".`);
      } catch (err) {
        console.warn(`[Nickname] Não foi possível alterar apelido de ${userId}:`, err.message);
      }
    }
  }

  // Localiza o canal de anúncio (preferência pelo canal #telamento)
  const channel = guild ? await findAnnouncementChannel(guild) : null;
  let messageId = null;
  let channelId = null;

  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const watchUrl = `${baseUrl}/watch/${finalStreamId}`;

  if (channel) {
    channelId = channel.id;

    const publicEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📺 Transmissão de Tela Ao Vivo')
      .setDescription(
        member?.voice?.channel
          ? `<@${userId}> iniciou uma transmissão de tela no canal de voz **${voiceChannelName}**!`
          : `<@${userId}> iniciou uma transmissão de tela!`
      )
      .addFields(
        {
          name: '🖥️ Qualidade',
          value: '`1080p @ 60 FPS (GPU NVENC/AMD)`',
          inline: true
        },
        {
          name: '⚡ Player Web',
          value: '`Low-Latency HLS (~1.5s delay)`',
          inline: true
        },
        {
          name: '📊 Status',
          value: '`🟢 AO VIVO`',
          inline: true
        }
      )
      .setFooter({
        text: '💡 Dica: Abra o player para assistir em Tela Cheia ou Janela Flutuante (PiP).'
      })
      .setTimestamp();

    const publicRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👁️ Assistir no Navegador (PiP)')
        .setStyle(ButtonStyle.Link)
        .setURL(watchUrl),
      new ButtonBuilder()
        .setLabel('📶 Link Direto (Stream)')
        .setStyle(ButtonStyle.Link)
        .setURL(streamUrl),
      new ButtonBuilder()
        .setCustomId('pip_tip')
        .setLabel('❓ Dicas & Ajuda')
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const publicMessage = await channel.send({
        embeds: [publicEmbed],
        components: [publicRow]
      });
      messageId = publicMessage.id;
    } catch (err) {
      console.error('[StreamManager] Erro ao enviar mensagem no canal de anúncio:', err);
    }
  }

  // Registra no store
  const record = streamStore.setStream(userId, {
    streamId: finalStreamId,
    userId,
    streamUrl,
    watchUrl,
    channelId,
    messageId,
    voiceChannelId,
    voiceChannelName,
    guildId: guild?.id || null,
    originalNickname,
    changedNickname,
    startedAt: new Date()
  });

  return {
    success: true,
    streamId: finalStreamId,
    watchUrl,
    channelId,
    messageId,
    record
  };
}

/**
 * Encerra uma transmissão ativa, atualizando o anúncio no Discord e restaurando apelido.
 * @param {import('discord.js').Client} client
 * @param {string} userId
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, activeStream?: Object }>}
 */
async function endStreamSession(client, userId, options = {}) {
  const reason = options.reason || 'manual';
  const activeStream = streamStore.getStream(userId);

  if (!activeStream) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  streamStore.deleteStream(userId);

  let footerText = 'Sessão encerrada pelo transmissor.';
  if (reason === 'voice_leave') {
    footerText = 'Sessão encerrada automaticamente (transmissor saiu da call).';
  } else if (reason === 'superseded') {
    footerText = 'Sessão anterior encerrada (nova transmissão iniciada).';
  }

  // Atualiza a mensagem no Discord removendo os botões
  if (activeStream.channelId && activeStream.messageId && client?.channels) {
    try {
      const channel = client.channels.cache?.get(activeStream.channelId)
        || (client.channels.fetch ? await client.channels.fetch(activeStream.channelId).catch(() => null) : null);
      if (channel) {
        const publicMessage = channel.messages?.cache?.get(activeStream.messageId)
          || (channel.messages?.fetch ? await channel.messages.fetch(activeStream.messageId).catch(() => null) : null);
        if (publicMessage) {
          const startedTimestamp = activeStream.startedAt
            ? Math.floor(new Date(activeStream.startedAt).getTime() / 1000)
            : Math.floor(Date.now() / 1000);

          const endedEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⏹️ Transmissão de Tela Encerrada')
            .setDescription(`A transmissão de <@${userId}> foi finalizada.`)
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

          await publicMessage.edit({
            embeds: [endedEmbed],
            components: []
          });
        }
      }
    } catch (err) {
      console.warn(`[StreamManager] Não foi possível atualizar a mensagem pública da stream de ${userId}:`, err.message);
    }
  }

  // Restaura apelido do usuário
  if (activeStream.guildId && activeStream.changedNickname && client?.guilds) {
    try {
      const guild = client.guilds.cache?.get(activeStream.guildId)
        || (client.guilds.fetch ? await client.guilds.fetch(activeStream.guildId).catch(() => null) : null);
      if (guild) {
        const member = guild.members?.cache?.get(userId)
          || (guild.members?.fetch ? await guild.members.fetch(userId).catch(() => null) : null);
        const isManageable = await canManageMember(guild, member);
        if (member && isManageable) {
          await member.setNickname(activeStream.originalNickname ?? null);
          console.log(`[Nickname] Apelido de ${member.displayName || userId} restaurado.`);
        }
      }
    } catch (err) {
      console.warn(`[Nickname] Não foi possível restaurar apelido do usuário ${userId}:`, err.message);
    }
  }

  return { success: true, activeStream };
}

module.exports = {
  canManageMember,
  findAnnouncementChannel,
  startStreamSession,
  endStreamSession
};
