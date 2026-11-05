# 📡 Discord Screen Relay (1080p 60FPS) com OBS Studio

Bot para Discord desenvolvido em **Node.js (discord.js v14)** integrado ao **OBS Studio**, **MediaMTX** e **Cloudflare Quick Tunnel**. Esta solução foi criada para substituir o VDO.ninja e o compartilhamento nativo do Discord, entregando transmissão de tela com aceleração nativa por GPU (NVENC/AMD), 1080p 60 FPS cravados, áudio isolado e **custo R$ 0,00 sem limites de banda**.

---

## 🚀 Destaques da Solução

- 🖥️ **Qualidade Full HD Real (1080p @ 60 FPS):** Codificado diretamente pela placa de vídeo do streamer (NVENC/AMD/QuickSync), sem os borrões ou congelamentos do compartilhamento padrão.
- ⚡ **Baixa Latência (~1.5s via Low-Latency HLS):** Transmissão estável via HTTP/HTTPS sem bloqueios de CGNAT ou portas fechadas.
- 🤖 **Automação Total no Discord:**
  - O streamer apenas clica em **"Iniciar Transmissão"** no OBS.
  - O script embutido no OBS inicializa o relay silenciosamente e gera o túnel público.
  - O bot anuncia a live automaticamente no canal de texto **`#telamento`**, mencionando o streamer e adicionando o sufixo `| 🔴 LIVE` ao apelido dele na chamada.
- 🖼️ **Player Web Próprio:**
  - Visual moderno em Dark Theme.
  - Suporte nativo a **Picture-in-Picture (PiP)**: assista em janela flutuante sobreposta ao jogo.
  - Modo Tela Cheia, controles nativos de volume e reconexão automática se a live oscilar.
- 🛡️ **Zero Fricção & Custo Zero:**
  - Não exige abertura de portas no modem nem cadastro em serviços pagos.
  - Instalador de 1 clique (`relay/install-relay.bat`) que baixa os binários portáteis automaticamente.

---

## 📂 Estrutura do Projeto

```text
discord-screen/
├── relay/                       # Pacote portátil para os streamers (OBS)
│   ├── obs-stream-sync.lua      # Script embutido do OBS Studio
│   ├── mediamtx.yml             # Configuração otimizada de RTMP -> HLS
│   ├── install-relay.bat        # Instalador automático de 1 clique
│   └── README.md                # Guia rápido para os amigos
├── src/
│   ├── commands/
│   │   ├── stream.js            # Comando /stream (status ou guia de OBS)
│   │   └── endstream.js         # Comando /endstream (encerramento manual)
│   ├── events/
│   │   ├── interaction.js       # Tratamento de interações e botões
│   │   ├── ready.js             # Inicialização do bot e registro de comandos
│   │   └── voiceStateUpdate.js  # Atualização de apelido e encerramento ao sair da call
│   ├── public/
│   │   ├── player.html          # Player Web moderno (Hls.js + PiP + Dark Mode)
│   │   └── offline.html         # Tela amigável de transmissão encerrada
│   ├── utils/
│   │   ├── streamManager.js     # Gerenciador de anúncios no #telamento e apelidos
│   │   └── streamStore.js       # Gerenciador em memória das transmissões ativas
│   ├── server.js                # Servidor HTTP nativo (API de webhooks e Player)
│   └── index.js                 # Ponto de entrada do Bot
├── test/                        # Testes automatizados (TDD)
│   ├── commands.test.js
│   ├── server.test.js
│   ├── streamManager.test.js
│   ├── streamStore.test.js
│   └── webPlayer.test.js
├── .env.example
├── package.json
└── README.md
```

---

## 🛠️ Configuração do Bot (Para o Administrador / Host)

### 1. Pré-requisitos
- **Node.js:** Versão 20.x ou superior.
- **NPM** instalado.

### 2. Instalação das Dependências
```bash
npm install
```

### 3. Configurar o arquivo `.env`
Crie o arquivo `.env` a partir do modelo `.env.example`:
```env
DISCORD_TOKEN=seu_token_do_discord_aqui
CLIENT_ID=seu_client_id_aqui
GUILD_ID=seu_servidor_de_testes_opcional

PORT=3000
BASE_URL=http://localhost:3000
OBS_WEBHOOK_SECRET=uma_chave_secreta_segura

ANNOUNCEMENT_CHANNEL_NAME=telamento
```

### 4. Executar os Testes
```bash
npm test
```

### 5. Iniciar o Bot
```bash
npm start
```

---

## 🎮 Guia para os Amigos (Como Transmitir pelo OBS)

Compartilhe a pasta **`relay/`** com os amigos que forem transmitir:

1. **Instalação em 1 Clique:**
   - Dê dois cliques em **`relay/install-relay.bat`**. Ele baixará o `mediamtx.exe` e o `cloudflared.exe` automaticamente.
2. **Adicionar o Script no OBS:**
   - No OBS Studio, vá em **Ferramentas** > **Scripts**.
   - Clique em **`+`** e selecione `relay/obs-stream-sync.lua`.
   - Preencha o seu **ID do Discord**, a **URL do Bot** e a **Chave Secreta**.
3. **Configurar a Transmissão no OBS:**
   - Vá em **Configurações** > **Transmissão**.
   - Selecione **Serviço:** `Personalizado...`
   - **Servidor:** `rtmp://localhost:1935/live`
   - **Chave de transmissão:** `live`
4. **Transmitir:**
   - Entre na chamada de voz do Discord e clique em **"Iniciar Transmissão"** no OBS.
   - O bot publicará o link da sua live automaticamente no canal **#telamento**!
