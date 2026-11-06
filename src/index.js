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
const { startServer } = require('./server');
const { startStreamSession, endStreamSession, updateStreamThumbnail } = require('./utils/streamManager');
const streamStore = require('./utils/streamStore');

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

// Diagnostico de conexao ao Gateway
let lastDebugMessage = 'Nenhuma mensagem de debug ainda';
let lastGatewayError = null;
let lastDisconnectInfo = null;

client.on('debug', info => {
  lastDebugMessage = info;
  // Apenas loga no console se nao for spam de heartbeat
  if (!info.includes('heartbeat') && !info.includes('Latency of')) {
    console.log(`[DJS Debug] ${info}`);
  }
});

client.on('error', err => {
  lastGatewayError = err?.message || String(err);
  console.error('[DJS Error]', err);
});

client.on('shardError', (err, shardId) => {
  lastGatewayError = `Shard ${shardId}: ${err?.message || err}`;
  console.error(`[DJS Shard ${shardId} Error]`, err);
});

client.on('shardDisconnect', (event, shardId) => {
  lastDisconnectInfo = { shardId, code: event?.code, reason: event?.reason };
  console.warn(`[DJS Shard ${shardId} Disconnect] Code: ${event?.code}, Reason: ${event?.reason}`);
});

client.on('shardReconnecting', shardId => {
  console.log(`[DJS Shard ${shardId}] Reconectando ao Gateway...`);
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
    const activeStreams = streamStore.getAllStreams();
    for (const stream of activeStreams) {
      await endStreamSession(client, stream.userId, { reason: 'manual' }).catch(() => null);
    }
  } catch (err) {
    console.error('Erro durante desligamento gracioso:', err.message);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 6. Conexão com o Discord Gateway
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.log('\nFalha ao conectar ao Discord Gateway: ' + error.message);
  console.log('Verifique se o token fornecido no .env é válido e tem as permissões corretas no Developer Portal.\n');
  process.exit(1);
});

// 7. Inicialização do Servidor HTTP Integrado (Player Web + Webhooks do OBS)
startServer({
  port: process.env.PORT || 3000,
  secret: process.env.OBS_WEBHOOK_SECRET,
  onStreamStart: async (payload) => {
    return await startStreamSession(client, payload);
  },
  onStreamStop: async (payload) => {
    return await endStreamSession(client, payload.userId, { reason: 'manual' });
  },
  onThumbnailUpdate: async ({ userId }) => {
    return await updateStreamThumbnail(client, userId);
  }
}).catch(err => {
  console.error('[HTTP Server] Falha ao iniciar servidor HTTP:', err);
});