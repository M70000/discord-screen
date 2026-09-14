require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Collection,
  Options
} = require('discord.js');

// 1. Verificacao inicial de variaveis de ambiente
if (!process.env.DISCORD_TOKEN) {
  console.error('\n[ERRO DE CONFIGURACAO] DISCORD_TOKEN nao foi configurado!');
  console.error('Crie um arquivo .env na raiz do projeto baseado no .env.example:');
  console.error('   DISCORD_TOKEN=seu_token_aqui');
  console.error('   CLIENT_ID=seu_client_id_aqui\n');
  process.exit(1);
}

// 2. Inicializacao do Client Discord com otimizacao de memoria para 24/7
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    UserManager: 0,
    PresenceManager: 0,
    ReactionManager: 0,
    GuildMemberManager: 0,
    ThreadManager: 0,
    GuildScheduledEventManager: 0,
    AutoModerationRuleManager: 0,
    StageInstanceManager: 0
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 300, lifetime: 60 }
  }
});


// 3. Carregamento Dinamico de Comandos
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Comando carregado: /${command.data.name}`);
    } else {
      console.warn('Aviso: O arquivo de comando em ' + filePath + ' esta ausente de data ou execute.');
    }
  }
}


// 4. Carregamento Dinamico de Eventos
const eventsPath = path.join(__dirname, 'events');
 if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`Evento carregado: ${event.name}`);
  }
}

// 5. Tratamento de Erros Globais e Desligamento Gracioso
process.on('unhandledRejection', error => {
  console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

const gracefulShutdown = async () => {
  console.log('\n[Bot] Desligamento solicitado. Encerrando streams ativas e restaurando apelidos...');
  try {
    const { endStreamSession } = require('./utils/streamManager');
    const streamStore = require('./utils/streamStore');
    const activeUserIds = Array.from(streamStore.getAllStreams().keys());
    for (const userId of activeUserIds) {
      await endStreamSession(client, userId, { reason: 'manual' }).catch(() => null);
    }
  } catch (err) {
    console.error('Erro durante desligamento gracioso:', err.message);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 6. Conexao com o Discord Gateway
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.log('\nFalha ao conectar ao Discord Gateway: ' + error.message);
  console.log('Verifique se o token fornecido no .env e valido e tem as permissoes corretas no Developer Portal.\n');
  process.exit(1);
});

// 7. Servidor HTTP de Health Check (para Render.com e pings 24/7 do UptimeRobot)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    bot: client.user ? client.user.tag : 'conectando...',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`[HealthCheck] Servidor HTTP ouvindo na porta ${PORT}`);
});