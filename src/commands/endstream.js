const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const streamStore = require('../utils/streamStore');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('endstream')
    .setDescription('Encerra a sua transmissão ativa de tela e desativa os links'),

  /**
   * Execução do comando /endstream
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const activeStream = streamStore.getStream(interaction.user.id);

    if (!activeStream) {
      return interaction.reply({
        content: '⚡︍ **Você não possui nenhuma transmissão ativa** registrada no momento.',
        ephemeral: true
      });
    }

    // Tenta atualizar a mensagem pública original para indicar que a transmissão foi encerrada
    try {
      const channel = await interaction.client.channels.fetch(activeStream.channelId);
      if (channel) {
        const publicMessage = await channel.messages.fetch(activeStream.messageId);
        if (publicMessage) {
          const startedTimestamp = activeStream.startedAt
            ? Math.floor(new Date(activeStream.startedAt).getTime() / 1000)
            : Math.floor(Date.now() / 1000);

          const endedEmbed = new EmbedBuilder()
            .setColor(0xED4245) // Vermelho Discord
            .setTitle('🜑  Transmissão de Tela Encerrada')
            .setDescription(`A transmissão de <@${interaction.user.id}> no canal **[${activeStream.voiceChannelName}]** foi finalizada.`)
            .addFields(
              {
                name: '⍇ Início',
                value: `<t:${startedTimestamp}:R>`,
                inline: true
              },
              {
                name: '💪 Status',
                value: '`Encerrada`',
                inline: true
              }
            )
            .setFooter({ text: 'Sessão encerrada pelo transmissor.' })
            .setTimestamp();

          // Atualiza a mensagem removendo os botões interativos
          await publicMessage.edit({
            embeds: [endedEmbed],
            components: []
          });
        }
      }
    } catch (error) {
      console.warn('Aviso: Não foi possível editar a mensagem pública original da stream:', error.message);
    }


    // Remove do armazenamento
    streamStore.deleteStream(interaction.user.id);


    return interaction.reply({
      content: '✅ **Sua transmissão foi encerrada com sucesso.** Os botões de acesso foram desativados.',
      ephemeral: true
    });
  }
};