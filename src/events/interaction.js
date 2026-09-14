const {
  EmbedBuilder,
  Events
} = require('discord.js');


module.exports = {
  name: Events.InteractionCreate,
  once: false,

  /**
   * Evento disparado para todas as interacoes
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {
    // 1. Tratamento de Comandos Slash
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Comando nao encontrado: ${interaction.commandName}`);
        return interaction.reply({
          content: '❏ Este comando nao foi reconhecido pelo bot.',
          ephemeral: true
        });
      }


      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Erro ao executar /${interaction.commandName}:`, error);

        const errorMessage = {
          content: '❏ Ocorreu um erro interno ao processar este comando.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
      return;
    }

    // 2. Tratamento de Botoes Interativos
    if (interaction.isButton()) {
      if (interaction.customId === 'pip_tip') {
        const tipEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🛿 Guia do Picture-in-Picture & Transmissao')
          .setDescription('Aproveite a experiencia do **Go Live alternativo** com maxima qualidade e produtividade!')
          .addFields(
            {
              name: '💕 Como ativar a Janela Flutuante (Always-on-Top)',
              value: [
                '1. Clique em **Assistir Transmissao (PiP)**.',
                '2. No player que abrir no navegador, clique no icone **PiP** no canto do video.',
                '3. Uma janela flutuante se abrira e permanecera fixa por cima de jogos e do Discord!',
                '4. Voce pode redimensionar a janela arrastando os cantos.'
              ].join('\n')
            },
            {
              name: '🔵 Como transmitir o som do jogo/sistema',
              value: [
                '• No navegador, quando a janela nativa de compartilhamento abrir:',
                '• Selecione a tela ou janela do jogo.',
                '• **Marque a opcao "Compartilhar audio do sistema"** no canto inferior esquerdo da janela de selecao.'
              ].join('\n')
            },
            {
              name: '⚑ Dicas Rapidas de Navegadores',
              value: [
                '• **Chrome / Edge / Brave:** Botao PiP dedicado no player ou no icone de midia da barra superior.',
                '• **Firefox:** Icone azul de PiP flutuante na lateral do player.',
                '• **Latencia P2P:** A transmissao e ponto a ponto direta via WebRTC, sem servidores de retransmissao (~100ms de latencia).'
              ].join('\n')
            }
          )
          .setFooter({ text: 'IDO.ninja WebRTC P2P ! 1080p 60fps' });


        return interaction.reply({
          embeds: [tipEmbed],
          ephemeral: true
        });
      }
    }
  }
};