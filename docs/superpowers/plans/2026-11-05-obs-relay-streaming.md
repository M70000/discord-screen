# OBS Studio Relay Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a integração legada do VDO.ninja por uma solução de transmissão com OBS Studio, Relay Local (MediaMTX + Cloudflare Tunnel), Player Web próprio e automação completa no Discord pelo canal `#telamento`.

**Architecture:** O streamer utiliza um script Lua embutido no OBS Studio que gerencia o MediaMTX e o Cloudflare Quick Tunnel em segundo plano. Ao clicar em "Iniciar Transmissão", o script detecta o início, captura a URL pública HTTPS gerada e notifica o servidor HTTP do Bot do Discord. O bot anuncia a transmissão no canal `#telamento` com links para um Player Web customizado (Low-Latency HLS via Hls.js) e atualiza o apelido do streamer.

**Tech Stack:** Node.js 20+ (Discord.js v14, `node:http`, `node:crypto`), OBS Studio Lua API (`obslua`), MediaMTX (RTMP -> LL-HLS), Cloudflare Quick Tunnel (`cloudflared`), Hls.js (HTML5 Video Player).

**Spec:** [docs/superpowers/specs/2026-11-05-obs-relay-streaming-design.md](../../superpowers/specs/2026-11-05-obs-relay-streaming-design.md)

## Global Constraints

- Custo R$ 0,00 obrigatório: nenhuma dependência de serviços pagos.
- Zero dependências pesadas de terceiros no Node: usar `node:http` nativo para a API e servidor web.
- Streamers utilizam Windows 10/11 com OBS Studio 28+.
- Processos locais do streamer (`mediamtx.exe` e `cloudflared.exe`) devem rodar sem janelas pretas visíveis e fechar com o OBS.
- O canal padrão de anúncios no Discord é `#telamento` (resolvido por `ANNOUNCEMENT_CHANNEL_ID` ou por busca textual `telamento`).
- Comunicação OBS -> Bot protegida por token secreto compartilhado (`OBS_WEBHOOK_SECRET`).

## Review Focus

1. **Tentativa de requisição ao webhook com secret inválido ou ausente:** Deve retornar HTTP 401 Unauthorized imediatamente sem tocar no estado do bot. (Testado na Task 3).
2. **Streamer inicia live no OBS mas não está em nenhum canal de voz:** O bot ainda deve publicar o anúncio no `#telamento` normalmente, sem tentar alterar apelido ou quebrar por falta de canal de voz. (Testado na Task 4).
3. **URL do Cloudflare Tunnel malformada ou payload incompleto enviado ao webhook:** Deve retornar HTTP 400 Bad Request com mensagem descritiva sem corromper o `streamStore`. (Testado na Task 3).
4. **Tentativa de abrir a página de player para um streamer offline ou inexistente:** Deve exibir uma página HTML amigável informando "Transmissão Offline" com botão para retornar ao Discord, em vez de tela branca ou crash. (Testado na Task 2 e Task 3).
5. **Re-ativação ou substituição de stream ativa:** Se o mesmo streamer iniciar uma nova live sem encerrar formalmente a anterior, a mensagem antiga deve ser atualizada para encerrada antes de criar a nova. (Testado na Task 1 e Task 4).

---

### Task 1: Modelo de Dados e Gerenciador de Estado (`streamStore`)

**Files:**
- Modify: `src/utils/streamStore.js`
- Test: `test/streamStore.test.js`

**Interfaces:**
- Produces:
  - `setStream(userId, streamData)`: Armazena `{ streamId, userId, streamUrl, channelId, messageId, voiceChannelId, originalNickname, changedNickname, startedAt }`
  - `getStream(userId)`: Retorna o objeto de stream do usuário ou `null`
  - `getStreamById(streamId)`: Retorna a stream correspondente a um `streamId` único ou `null`
  - `hasActiveStream(userId)`: Retorna booleano
  - `deleteStream(userId)`: Remove a stream do usuário e retorna a stream removida
  - `getAllStreams()`: Retorna lista de todas as streams ativas

- [ ] **Step 1: Escrever teste automatizado para o novo modelo de dados**

Criar `test/streamStore.test.js` testando inserção, busca por userId, busca por streamId, exclusão e listagem geral.

```javascript
const assert = require('assert');
const streamStore = require('../src/utils/streamStore');

// Teste de ciclo de vida do streamStore
const userId = '111222333';
const streamData = {
  streamId: 'live_test_123',
  userId,
  streamUrl: 'https://test.trycloudflare.com',
  channelId: 'channel_1',
  messageId: 'msg_1'
};

streamStore.setStream(userId, streamData);
assert.strictEqual(streamStore.hasActiveStream(userId), true);
assert.strictEqual(streamStore.getStream(userId).streamId, 'live_test_123');
assert.strictEqual(streamStore.getStreamById('live_test_123').userId, userId);
assert.strictEqual(streamStore.getAllStreams().length, 1);

streamStore.deleteStream(userId);
assert.strictEqual(streamStore.hasActiveStream(userId), false);
assert.strictEqual(streamStore.getStream(userId), null);
assert.strictEqual(streamStore.getStreamById('live_test_123'), null);
console.log('Task 1 tests passed.');
```

- [ ] **Step 2: Executar teste para verificar falha**

Run: `node test/streamStore.test.js`  
Expected: FAIL (método `getStreamById` ou novas propriedades inexistentes)

- [ ] **Step 3: Implementar métodos no `src/utils/streamStore.js`**

Implementar mapa de indexação por `userId` e por `streamId`, adicionando `getStreamById`, `getAllStreams` e validações de data.

- [ ] **Step 4: Executar teste para verificar sucesso**

Run: `node test/streamStore.test.js`  
Expected: PASS com "Task 1 tests passed."

- [ ] **Step 5: Git commit**

```bash
git add src/utils/streamStore.js test/streamStore.test.js
git commit -m "feat(store): enhance streamStore with streamId index and query helpers"
```

---

### Task 2: Player Web Customizado (HTML5 + Hls.js + PiP + Dark Mode)

**Files:**
- Create: `src/public/player.html`
- Create: `src/public/offline.html`

**Interfaces:**
- Consumes: A URL pública do stream HLS (ex: `https://<tunnel>.trycloudflare.com/live/index.m3u8`) injetada via template/query param `?src=...`
- Produces: Interface web com controles de vídeo, tela cheia, botão de Picture-in-Picture flutuante e reconexão automática.

- [ ] **Step 1: Criar template do Player Web em `src/public/player.html`**

Construir página com visual moderno:
- Fundo escuro (#0f1117 / #1e1f29) e tipografia limpa.
- Elemento `<video id="video" playsinline controls autoplay muted>`
- Script que importa `hls.js` via CDN e inicializa com `lowLatencyMode: true`, `backBufferLength: 10`, `maxBufferLength: 2`.
- Botões auxiliares: "🖼️ Janela Flutuante (PiP)", "⛶ Tela Cheia", "🔊 Desmutar Áudio".
- Overlay com banner: "🔴 AO VIVO - Transmissão de Tela".

- [ ] **Step 2: Criar página de fallback em `src/public/offline.html`**

Página elegante exibida quando a transmissão foi encerrada ou o ID não existe:
- Ícone de TV desligada 📺
- Mensagem: "Esta transmissão foi encerrada ou não está disponível."
- Botão "Voltar ao Discord".

- [ ] **Step 3: Validar a sintaxe e integridade do HTML**

Run: `node -e "const fs = require('fs'); assert(fs.existsSync('src/public/player.html') && fs.existsSync('src/public/offline.html')); console.log('HTML files created.');"`  
Expected: PASS com "HTML files created."

- [ ] **Step 4: Git commit**

```bash
git add src/public/player.html src/public/offline.html
git commit -m "feat(web): add modern HLS web player and offline fallback pages"
```

---

### Task 3: Servidor HTTP e Endpoints de Webhook (`src/server.js`)

**Files:**
- Create: `src/server.js`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes:
  - `process.env.PORT` (padrão 3000)
  - `process.env.OBS_WEBHOOK_SECRET`
  - Funções de callback para eventos de live: `onStreamStart(payload)` e `onStreamStop(payload)`
- Produces:
  - `startServer({ port, secret, onStreamStart, onStreamStop })`: Inicializa o servidor HTTP nativo.
  - Rotas:
    - `POST /api/stream/start`: Valida secret e payload `{ userId, streamUrl, streamId }`, chama `onStreamStart` e retorna 200 JSON.
    - `POST /api/stream/stop`: Valida secret e payload `{ userId }`, chama `onStreamStop` e retorna 200 JSON.
    - `GET /watch/:id`: Serve `src/public/player.html` configurado para o stream ativo, ou `offline.html`.
    - `GET /health`: Retorna 200 OK `{ status: 'online' }`.

- [ ] **Step 1: Escrever teste de unidade para as rotas HTTP em `test/server.test.js`**

```javascript
const assert = require('assert');
const http = require('http');
const { createServerInstance } = require('../src/server');

// Testa autenticação 401, health 200 e rotas de start/stop
// (Implementa testes com client http nativo disparando requisições locais)
```

- [ ] **Step 2: Executar teste para verificar falha**

Run: `node test/server.test.js`  
Expected: FAIL (módulo `src/server.js` inexistente)

- [ ] **Step 3: Implementar `src/server.js` com `node:http` nativo**

Implementar parser de JSON, validação de token `Bearer` ou header `X-Webhook-Secret`, roteamento simples e entrega de arquivos estáticos.

- [ ] **Step 4: Executar teste para verificar sucesso**

Run: `node test/server.test.js`  
Expected: PASS com todos os testes passando.

- [ ] **Step 5: Git commit**

```bash
git add src/server.js test/server.test.js
git commit -m "feat(api): implement native HTTP server with webhook routes and player host"
```

---

### Task 4: Gerenciador de Transmissão e Notificações no `#telamento` (`src/utils/streamManager.js`)

**Files:**
- Modify: `src/utils/streamManager.js`
- Modify: `src/events/voiceStateUpdate.js`
- Modify: `src/index.js`
- Test: `test/streamManager.test.js`

**Interfaces:**
- Consumes: `streamStore`, `discord.js Client`, `src/server.js`
- Produces:
  - `handleStreamStart(client, { userId, streamUrl, streamId })`:
    - Localiza o servidor e o canal `#telamento`.
    - Se o usuário estiver em um canal de voz, atualiza apelido para `| 🔴 LIVE`.
    - Publica Embed rico no `#telamento` com botões "Assistir no Navegador" e "Dicas & Ajuda".
    - Registra a live no `streamStore`.
  - `handleStreamStop(client, { userId })`:
    - Atualiza a mensagem no `#telamento` para "⏹️ Transmissão Encerrada" e desativa botões.
    - Restaura o apelido original do streamer.
    - Remove do `streamStore`.

- [ ] **Step 1: Escrever teste para a lógica de resolução de canal e montagem de embeds**

Criar `test/streamManager.test.js` simulando `guild`, `channel` e `member` com mocks do Discord.js para validar a criação correta de botões com a URL do player e o envio no canal `telamento`.

- [ ] **Step 2: Executar teste para verificar falha**

Run: `node test/streamManager.test.js`  
Expected: FAIL

- [ ] **Step 3: Implementar as funções em `src/utils/streamManager.js` e plugar no `src/index.js`**

- Adicionar busca inteligente do canal `#telamento`:
  ```javascript
  const channel = guild.channels.cache.get(process.env.ANNOUNCEMENT_CHANNEL_ID) 
    || guild.channels.cache.find(c => c.name === (process.env.ANNOUNCEMENT_CHANNEL_NAME || 'telamento') && c.isTextBased());
  ```
- No `src/index.js`, inicializar o servidor HTTP do `src/server.js` junto com o `client.login`.

- [ ] **Step 4: Executar teste para verificar sucesso**

Run: `node test/streamManager.test.js`  
Expected: PASS

- [ ] **Step 5: Git commit**

```bash
git add src/utils/streamManager.js src/index.js src/events/voiceStateUpdate.js test/streamManager.test.js
git commit -m "feat(discord): integrate automated live announcements into #telamento channel"
```

---

### Task 5: Adaptação dos Slash Commands (`/stream` e `/endstream`)

**Files:**
- Modify: `src/commands/stream.js`
- Modify: `src/commands/endstream.js`
- Test: `test/commands.test.js`

**Interfaces:**
- `/stream`:
  - Se `streamStore.hasActiveStream(interaction.user.id)`: Retorna embed público informando que a live está ativa com botões para assistir.
  - Se offline: Retorna embed efêmero privado com instruções de como configurar o OBS e o link para a documentação/download do relay.
- `/endstream`:
  - Encerra a transmissão do usuário no Discord caso ele queira fechar antes do OBS ou se o script não tiver disparado o stop.

- [ ] **Step 1: Escrever teste para os comandos `/stream` e `/endstream`**

Criar `test/commands.test.js` simulando interação do Discord para os dois cenários (online e offline).

- [ ] **Step 2: Executar teste para verificar falha**

Run: `node test/commands.test.js`  
Expected: FAIL

- [ ] **Step 3: Atualizar `src/commands/stream.js` e `src/commands/endstream.js`**

Substituir todas as chamadas do VDO.ninja por consultas ao `streamStore` e URLs do Player Web interno.

- [ ] **Step 4: Executar teste para verificar sucesso**

Run: `node test/commands.test.js`  
Expected: PASS

- [ ] **Step 5: Git commit**

```bash
git add src/commands/stream.js src/commands/endstream.js test/commands.test.js
git commit -m "refactor(commands): adapt /stream and /endstream for OBS relay architecture"
```

---

### Task 6: Pacote do Streamer no OBS (`relay/`)

**Files:**
- Create: `relay/obs-stream-sync.lua`
- Create: `relay/mediamtx.yml`
- Create: `relay/install-relay.bat`
- Create: `relay/README.md`

**Interfaces:**
- `obs-stream-sync.lua`:
  - Hook `script_load`: Inicia `mediamtx.exe` em segundo plano (porta 1935 RTMP, 8888 HLS).
  - Hook `script_unload`: Mata `mediamtx.exe` e `cloudflared.exe`.
  - Hook `obs.OBS_FRONTEND_EVENT_STREAMING_STARTED`: Inicia `cloudflared.exe`, monitora o arquivo de log para capturar `https://*.trycloudflare.com`, e envia `POST /api/stream/start`.
  - Hook `obs.OBS_FRONTEND_EVENT_STREAMING_STOPPED`: Mata `cloudflared.exe` e envia `POST /api/stream/stop`.
- `mediamtx.yml`: Configuração enxuta com RTMP ativado e HLS Low-Latency configurado (`hlsSegmentDuration: 1s`, `hlsPartDuration: 200ms`).
- `install-relay.bat`: Script Windows Batch que baixa os binários oficiais `mediamtx.exe` e `cloudflared.exe` via PowerShell `Invoke-WebRequest` e cria a pasta pronta para uso.

- [ ] **Step 1: Escrever a configuração otimizada `relay/mediamtx.yml`**

Definir portas 1935 (RTMP) e 8888 (HLS), desligando RTSP e WebRTC padrão se desnecessários para economia de recursos.

- [ ] **Step 2: Escrever o script `relay/obs-stream-sync.lua`**

Implementar tratamento de eventos do OBS, interface de propriedades com `discord_user_id`, `bot_url`, `webhook_secret`, e chamadas seguras em background no Windows (`wscript.shell` / PowerShell sem janelas visíveis).

- [ ] **Step 3: Criar o instalador automático `relay/install-relay.bat` e guia `relay/README.md`**

Instalador de 1 clique com progresso visual que baixa as ferramentas portáteis e deixa tudo na mesma pasta.

- [ ] **Step 4: Validar os arquivos do relay sintaticamente**

Run: `pwsh -Command "Get-ChildItem -Path relay"`  
Expected: Lista `install-relay.bat`, `mediamtx.yml`, `obs-stream-sync.lua`, `README.md`.

- [ ] **Step 5: Git commit**

```bash
git add relay/
git commit -m "feat(relay): add OBS Lua script, MediaMTX config and 1-click Windows installer"
```

---

### Task 7: Limpeza de Código Legado, Configuração e Testes Finais

**Files:**
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `README.md`
- Delete: `src/utils/vdoBuilder.js`
- Delete: `test/vdoBuilder.test.js`

**Interfaces:**
- Atualizar `.env.example` com:
  - `PORT=3000`
  - `OBS_WEBHOOK_SECRET=sua_chave_secreta_aqui`
  - `BASE_URL=http://localhost:3000` (ou URL do Render)
  - `ANNOUNCEMENT_CHANNEL_NAME=telamento`
- Atualizar `package.json` (`test` script apontando para suíte de testes completa).
- Atualizar `README.md` com guia passo a passo do novo sistema.

- [ ] **Step 1: Remover arquivos do VDO.ninja**

Excluir `src/utils/vdoBuilder.js` e `test/vdoBuilder.test.js`.

- [ ] **Step 2: Atualizar scripts no `package.json`**

Definir `"test": "node --test test/*.test.js"` ou runner integrado.

- [ ] **Step 3: Atualizar documentação e `.env.example`**

Descrever o fluxo com OBS Studio e configuração do canal `#telamento`.

- [ ] **Step 4: Executar a suíte completa de testes**

Run: `npm test`  
Expected: PASS em todos os módulos (store, server, streamManager, commands).

- [ ] **Step 5: Git commit**

```bash
git add .
git commit -m "chore: remove VDO.ninja legacy code and update documentation and tests"
```
