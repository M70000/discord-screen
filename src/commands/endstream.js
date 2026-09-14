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
    const result = await endStreamSession(interaction.client, interaction.user.id, {
      reason: 'manual'
    });

    if (!result.success) {
      return interaction.reply({
        content: '❌ **Você não possui nenhuma transmissão ativa** registrada no momento.',
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.reply({
      content: '✅ **Sua transmissão foi encerrada com sucesso.** Os botões de acesso foram desativados.',
      flags: MessageFlags.Ephemeral
    });
  }
};