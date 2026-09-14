const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { generateRoomId, buildPushUrl, buildViewUrl } = require('../utils/vdoBuilder');
const streamStore = require('../utils/streamStore');
const { endStreamSession, canManageMember } = require('../utils/streamManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Inicia uma transmissão de tela P2P em 1080p 60fps via VDO.ninja'),

  /**
   * Execução do comando /stream
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    // 1. Validação: Usuário deve estar conectado a um canal de voz
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ **Você precisa estar conectado a um canal de voz** para iniciar uma transmissão de tela!',
        flags: MessageFlags.Ephemeral
      });
    }

    // Se o usuário já possuía uma transmissão ativa, encerra a anterior
    if (streamStore.hasActiveStream(interaction.user.id)) {
      await endStreamSession(interaction.client, interaction.user.id, { reason: 'superseded' });
    }

    // 2. Geração do ID único e URLs otimizadas
    const roomId = generateRoomId();
    const pushUrl = buildPushUrl(roomId);
    const viewUrl = buildViewUrl(roomId);
    const viewProxyUrl = buildViewUrl(roomId, { proxy: true });

    // 3. Criação do Embed Público para o canal de voz/texto
    const publicEmbed = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Blurple
      .setTitle('📺 Transmissão de Tela Iniciada')
      .setDescription(`<@${interaction.user.id}> iniciou um compartilhamento de tela no canal **${voiceChannel.name}**.`)
      .addFields(
        {
          name: '🖥️ Qualidade',
          value: '`1080p @ 60 FPS (9.000 kbps)`',
          inline: true
        },
        {
          name: '⚡ Protocolo',
          value: '`WebRTC P2P (~100ms latência)`',
          inline: true
        }
      )
      .setFooter({
        text: '💡 Dica: Se estiver no 4G/5G ou der aviso de rede, use o botão "Link 4G/5G (Proxy)".'
      })
      .setTimestamp();

    // 4. Botões Públicos (Assistir + Link 4G/5G + Dicas)
    const publicRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👁️ Assistir Transmissão (PiP)')
        .setStyle(ButtonStyle.Link)
        .setURL(viewUrl),
      new ButtonBuilder()
        .setLabel('📶 Link 4G/5G (Proxy)')
        .setStyle(ButtonStyle.Link)
        .setURL(viewProxyUrl),
      new ButtonBuilder()
        .setCustomId('pip_tip')
        .setLabel('❓ Dicas & Ajuda')
        .setStyle(ButtonStyle.Secondary)
    );

    // 5. Envio da Mensagem Pública no chat do canal
    const response = await interaction.reply({
      embeds: [publicEmbed],
      components: [publicRow],
      withResponse: true
    });
    const publicMessage = response.resource?.message ?? (await interaction.fetchReply());

    // 6. Embed e Botões Privados (Efêmeros) para o Transmissor
    const streamerEmbed = new EmbedBuilder()
      .setColor(0x2ECC71) // Verde esmeralda
      .setTitle('🎮 Painel do Transmissor (Privado)')
      .setDescription([
        'Sua sala de transmissão foi gerada! Escolha abaixo como prefere transmitir:',
        '',
        '### 🚀 Opção 1: Game Capture App *(Recomendado para Jogos)*',
        'Captura o áudio isolado do jogo (sem eco da chamada) e usa aceleração da GPU (NVENC/AMD 60 FPS lisos).',
        '',
        '**Dados para colar no app:**',
        '• **Stream / URL:**',
        '```text',
        roomId,
        '```',
        '• **Password:** Deixe **em branco** (ou vazio)',
        '',
        '*Passo a passo no app:*',
        '1. Clique em **SELECT A SOURCE** e escolha a janela do jogo.',
        '2. No campo **Stream / URL**, copie e cole o código acima.',
        '3. Deixe **Password** vazio e clique para iniciar!',
        '',
        '---',
        '### 🌐 Opção 2: Pelo Navegador *(Sem Baixar Nada)*',
        'Clique no botão **"Iniciar no Navegador"** abaixo.',
        '*(Dica: Escolha "Tela Inteira" e marque "Compartilhar áudio do sistema")*'
      ].join('\n'))
      .setFooter({
        text: '🔒 Segredo: Não compartilhe esta mensagem. Use /endstream para encerrar a sala.'
      });

    const streamerRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🌐 Iniciar no Navegador (1080p60)')
        .setStyle(ButtonStyle.Link)
        .setURL(pushUrl),
      new ButtonBuilder()
        .setLabel('📥 Baixar Game Capture App')
        .setStyle(ButtonStyle.Link)
        .setURL('https://vdo.ninja/gamecapture')
    );

    await interaction.followUp({
      embeds: [streamerEmbed],
      components: [streamerRow],
      flags: MessageFlags.Ephemeral
    });

    // 7. Atualização do Apelido do Transmissor (ex: "Nome | 🔴 LIVE")
    const suffix = ' | 🔴 LIVE';
    const member = interaction.member;
    const originalNickname = member?.nickname ?? null;
    let changedNickname = false;

    const isManageable = await canManageMember(interaction.guild, member);
    if (member && isManageable) {
      try {
        const maxBaseLength = 32 - suffix.length;
        const cleanBaseName = member.displayName.replace(/\s*\|\s*🔴\s*LIVE$/i, '');
        const baseName = cleanBaseName.slice(0, maxBaseLength).trim();
        await member.setNickname(`${baseName}${suffix}`);
        changedNickname = true;
        console.log(`[Nickname] Apelido de ${interaction.user.tag} alterado para "${baseName}${suffix}".`);
      } catch (error) {
        console.warn(`[Nickname] Não foi possível alterar o apelido de ${interaction.user.tag}:`, error.message);
      }
    } else {
      console.log(`[Nickname] Usuário ${interaction.user.tag} não é gerenciável pelo bot (dono do servidor, cargo superior ou permissão ausente).`);
    }

    // 8. Salva a stream ativa no gerenciador
    streamStore.setStream(interaction.user.id, {
      roomId,
      channelId: interaction.channelId,
      messageId: publicMessage.id,
      voiceChannelId: voiceChannel.id,
      voiceChannelName: voiceChannel.name,
      pushUrl,
      viewUrl,
      streamerId: interaction.user.id,
      guildId: interaction.guildId,
      originalNickname,
      changedNickname,
      startedAt: new Date()
    });
  }
};
