const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const streamStore = require('../utils/streamStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Exibe o status da sua transmissão ativa ou instruções para iniciar no OBS'),

  /**
   * Execução do comando /stream
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const userId = interaction.user.id;
    // Registra este canal como preferencial para a live deste usuário
    if (interaction.channelId) {
      streamStore.setPreferredChannel(userId, interaction.channelId);
    }
    const activeStream = streamStore.getStream(userId);

    // Cenário 1: O usuário já está com transmissão ativa no OBS
    if (activeStream) {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const watchUrl = activeStream.watchUrl || `${baseUrl}/watch/${activeStream.streamId || userId}`;

      const activeEmbed = new EmbedBuilder()
        .setColor(0x2ECC71) // Verde esmeralda
        .setTitle('📺 Sua Transmissão de Tela está Ao Vivo!')
        .setDescription(`Você está transmitindo no canal **${activeStream.voiceChannelName || 'Discord'}**.`)
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
            value: '`🟢 ONLINE`',
            inline: true
          }
        )
        .setFooter({
          text: '💡 Dica: Compartilhe o link do player ou use /endstream para finalizar.'
        })
        .setTimestamp(activeStream.startedAt);

      const activeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('👁️ Assistir no Navegador (PiP)')
          .setStyle(ButtonStyle.Link)
          .setURL(watchUrl),
        new ButtonBuilder()
          .setCustomId('pip_tip')
          .setLabel('❓ Dicas & Ajuda')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [activeEmbed],
        components: [activeRow]
      });
    }

    // Cenário 2: Usuário offline (não iniciou o OBS ainda)
    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const downloadZipUrl = `${baseUrl}/download/relay.zip`;
    const downloadBatUrl = `${baseUrl}/download/install-relay.bat`;

    const guideEmbed = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Blurple
      .setTitle('🎮 Como Iniciar sua Transmissão com OBS Studio')
      .setDescription([
        'Nenhuma transmissão de tela foi detectada para você no momento.',
        '',
        '### 🚀 Passo a Passo Rápido:',
        `1. Baixe o pacote completo: **[📥 Baixar Pacote (relay.zip)](${downloadZipUrl})**`,
        '   • Extraia a pasta e execute **`install-relay.bat`** *(baixa os arquivos em segundos)*.',
        '2. No OBS Studio, abra o menu superior **Ferramentas > Scripts** e adicione o arquivo **`obs-stream-sync.lua`**.',
        '3. Nas opções do script, preencha apenas:',
        `   • **ID do Discord:** \`${userId}\``,
        '   • *(A URL do Bot e a Chave Secreta já vêm 100% pré-configuradas!)*',
        '4. Em **Configurações > Transmissão** no OBS, use:',
        '   • **Serviço:** Personalizado...',
        '   • **Servidor:** `rtmp://localhost:1935/live`',
        '   • **Chave de transmissão:** `live`',
        '',
        '👉 **Pronto!** Agora basta clicar em **"Iniciar Transmissão"** no OBS. O bot anunciará sua live automaticamente no canal **#telamento**!'
      ].join('\n'))
      .setFooter({
        text: '🔒 Zero janelas extras. O OBS liga e desliga o relay automaticamente.'
      });

    const guideRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('📥 Baixar Pacote do Relay (.ZIP)')
        .setStyle(ButtonStyle.Link)
        .setURL(downloadZipUrl),
      new ButtonBuilder()
        .setLabel('⚡ Baixar Instalador (.BAT)')
        .setStyle(ButtonStyle.Link)
        .setURL(downloadBatUrl)
    );

    return interaction.reply({
      embeds: [guideEmbed],
      components: [guideRow],
      flags: MessageFlags.Ephemeral
    });
  }
};
