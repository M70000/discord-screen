const {
  REST,
  Routes,
  ActivityType,
  Events
} = require('discord.js');


module.exports = {
  name: Events.ClientReady,
  once: true,

  /**
   * Evento disparado quando o bot está online
   * @param {import('discord.js').Client} client
   */
  async execute(client) {
    console.log('\n=======================================');
    console.log(`🤖 Conectado como: ${client.user.tag}`);
    console.log(`⚡ ID do Bot: ${client.user.id}`);
    console.log('========================================\n');

    // Atualiza status / presenca do bot
    client.user.setPresence({
      activities: [{ name: 'Live seca em 1080p60 | /stream', type: ActivityType.Watching }],
      status: 'online'
    });

    // Prepara dados dos comandos Slash
    const commandsData = [];
    for (const command of client.commands.values()) {
      commandsData.push(command.data.toJSON());
    }

    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID || client.user.id;
    const guildId = process.env.GUILD_ID;

    if (!token) {
      console.error('❮ ERRO: DISCORD_TOKEN nao foi configurado no arquivo .env!');
      return;
    }


    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log(`↗ Registrando ${commandsData.length} comando(s) Slash...`);


      if (guildId && guildId.trim() !== '') {
        // Registro instantaneo no servidor especifico
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId.trim()),
          { body: commandsData }
        );
        console.log(`✇ Comandos registrados com sucesso no servidor (Guild ID: ${guildId.trim()})!`);
      } else {
        // Registro global
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: commandsData }
        );
        console.log('✅ Comandos Slash registrados globalmente com sucesso!');
        console.log('💩 Dica: Se quiser que aparecam na hora sem esperar o cache global do Discord, coloque o GUILD_ID no .env!');
      }
    } catch (error) {
      console.error('⛮Erro ao registrar Slash Commands na API do Discord:', error);
    }
  }
};