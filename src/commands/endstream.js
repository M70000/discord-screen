const {
  SlashCommandBuilder,
  MessageFlags
} = require('discord.js');
const { endStreamSession } = require('../utils/streamManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('endstream')
    .setDescription('Encerra a sua transmissão ativa de tela e desativa os links'),

  /**
   * Execução do comando /endstream
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await endStreamSession(interaction.client, interaction.user.id, {
      reason: 'manual'
    });

    if (!result.success) {
      return interaction.editReply({
        content: '❌ **Você não possui nenhuma transmissão ativa** registrada no momento.'
      });
    }

    return interaction.editReply({
      content: '✅ **Sua transmissão foi encerrada com sucesso.** Os botões de acesso foram desativados.'
    });
  }
};