# 📡 Discord Go Live Alternativo (1080p 60FPS) com VDO.ninja

Bot para Discord desenvolvido em **Node.js (discord.js v14)** e integrado aos parâmetros de URL do **VDO.ninja (WebRTC P2P)**. Este projeto foi criado como uma solução de alta performance para suprir as instabilidades e limitações técnicas do compartilhamento de tela nativo (Go Live) do Discord no Brasil.

---

## 🚀 Destaques da Solução

- ⚡ **Latência Ultrabaixa (< 150ms):** Conexão P2P (ponto a ponto) direta entre transmissor e espectadores via WebRTC.
- 🖥️ **Qualidade Full HD Travada:** Resolução 1080p a 60 FPS com bitrate elevado a **9.000 kbps** (sem os borrões típicos de streams comprimidas).
- 🖼️ **Picture-in-Picture (Janela Flutuante):** Permite que quem assiste fixe a transmissão sobreposta a qualquer janela de jogo ou chat do Discord (*Always-on-Top*).
- 🛡️ **Zero Fricção & Alta Segurança:** 
  - Nenhum executável precisa ser baixado.
  - O link de transmissão (Push) é enviado de forma **efêmera (privada)** apenas ao streamer.
  - Acesso público protegido por IDs de sala criptograficamente aleatórios.

---

## 📂 Estrutura do Projeto

`	ext
discord-vdoninja-bot/
├── src/
│   ├── commands/
│   │   ├── stream.js        # Lógica do comando /stream e validação de voz
│   │   └── endstream.js     # Comando /endstream para encerrar e desativar botões
│   ├── utils/
│   │   ├── vdoBuilder.js    # Construtor dos parâmetros de URL do VDO.ninja
│   │   └── streamStore.js   # Gerenciador em memória das transmissões ativas
│   ├── events/
│   │   ├── ready.js         # Inicialização do bot e registro dos Slash Commands
│   │   └── interaction.js   # Manipulação de comandos e botões (Dica PiP)
│   └── index.js             # Ponto de entrada do bot
├── test/
│   └── vdoBuilder.test.js   # Testes automatizados dos parâmetros e store
├── .env.example             # Modelo das variáveis de ambiente
├── .gitignore               # Arquivos ignorados pelo Git
├── package.json
└── README.md                # Guia de configuração e uso
`

---

## 🛠️ Passo a Passo: Configuração no Discord Developer Portal

### 1. Criar a Aplicação
1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique no botão ** New Application** no canto superior direito.
3. Dê um nome à sua aplicação (ex: GoLive 1080p) e aceite os termos.

### 2. Obter o CLIENT_ID
1. Na aba lateral **General Information**, localize o campo **Application ID**.
2. Clique em **Copy** e guarde este valor (ele será o seu CLIENT_ID no .env).

### 3. Criar o Bot e Obter o DISCORD_TOKEN
1. No menu lateral esquerdo, vá em **Bot**.
2. Clique em **Reset Token** (confirme a autenticação 2FA se solicitada).
3. **Copie o Token gerado imediatamente** (ele será o seu DISCORD_TOKEN no .env).
4. Role a página até **Privileged Gateway Intents**:
   - A aplicação utiliza Guilds, GuildVoiceStates e GuildMessages (Slash Commands padrão não requerem Message Content Intent).

### 4. Convidar o Bot para o seu Servidor
1. No menu lateral esquerdo, acesse **OAuth2** > **URL Generator**.
2. Na seção **Scopes**, marque:
   - [x] bot
   - [x] applications.commands
3. Na seção inferior **Bot Permissions**, marque:
   - [x] Send Messages
   - [x] Embed Links
   - [x] Read Message History
   - [x] View Channel
4. Copie a URL gerada na parte inferior da página, cole-a no navegador e selecione o servidor Discord onde você deseja adicionar o bot.

---

## ⚙️ Instalação e Execução

### 1. Pré-requisitos
- **Node.js:** Versão 18.x, 20.x ou 24.x instalada.
- **NPM** instalado.

### 2. Instalar Dependências
`ash
npm install
`

### 3. Configurar Variáveis de Ambiente
Crie um arquivo .env na raiz do projeto a partir do exemplo:

`ash
cp .env.example .env
`

Abra o arquivo .env e preencha suas chaves:
`env
DISCORD_TOKEN=seu_token_aqui_copiado_do_developer_portal
CLIENT_ID=seu_client_id_aqui

# (Opcional) ID de um servidor de teste.
# Se preenchido, os comandos Slash são registrados instantaneamente nele!
# Se deixado vazio, os comandos são registrados globalmente.
GUILD_ID=
`

> 💡 **Dica de Desenvolvimento:** Para testar os comandos Slash de forma instantânea sem esperar o cache global do Discord, coloque o ID do seu servidor em GUILD_ID. Para obter o ID de um servidor, ative o Modo Desenvolvedor no Discord (Configurações > Avançado > Modo Desenvolvedor) e clique com o botão direito no ícone do servidor > Copiar ID do servidor.

### 4. Executar os Testes
Para garantir que todos os parâmetros de URL do VDO.ninja e gerenciadores estão íntegros:
`ash
npm test
`

### 5. Iniciar o Bot
`ash
npm start
`
Ou para desenvolvimento com auto-reload:
`ash
npm run dev
`

---

## 🎮 Como Usar

### 1. Iniciar uma Transmissão (/stream)
1. Entre em qualquer **Canal de Voz** do servidor Discord.
2. Digite /stream no chat de texto.
3. O bot enviará:
   - **Mensagem Pública no Chat:**
     - Um Embed elegante com visual Dark do Discord informando a qualidade (1080p @ 60 FPS, 9000 kbps) e o canal de voz ativo.
     - Botão 👁️ Assistir Transmissão (PiP): Abre o feed WebRTC direto com visual limpo.
     - Botão ❓ Dica do Picture-in-Picture: Abre um modal com instruções de áudio e janela flutuante.
   - **Mensagem Efêmera (Privada para o Streamer):**
     - Botão 🔴 Iniciar Compartilhamento de Tela (1080p60).
     - Ao clicar, o navegador abre automaticamente o seletor nativo de telas/janelas.
     - **Importante:** Marque a opção **Compartilhar áudio do sistema** no seletor para que o áudio do jogo seja transmitido.

### 2. Ativar Picture-in-Picture (Janela Flutuante para Espectadores)
1. Ao clicar em **Assistir Transmissão**, o navegador abrirá o player VDO.ninja.
2. Clique no ícone de **Picture-in-Picture** no canto do vídeo.
3. A janela se soltará da aba do navegador e ficará fixada sobreposta aos seus jogos e ao Discord (*Always-on-Top*).

### 3. Encerrar a Transmissão (/endstream)
1. Quando terminar de jogar, digite /endstream.
2. O bot atualiza a mensagem pública no chat, sinalizando que a live foi concluída, e remove os botões de acesso à sala.

---

## 📐 Parâmetros Técnicos Otimizados do VDO.ninja

### URL de Push (Transmissor)
`	ext
https://vdo.ninja/?push={ROOM_ID}&screenshare=1&fps=60&scale=1080&bitrate=9000&codec=h264&broadcast=1&webcam=0&autostart=1&cleanoutput=1
`
| Parâmetro | Finalidade |
| :--- | :--- |
| push={ROOM_ID} | Define a chave privada da sala gerada aleatoriamente. |
| screenshare=1 | Abre imediatamente o prompt de captura de tela nativo do SO/navegador. |
| ps=60 | Força a captura contínua a 60 quadros por segundo. |
| scale=1080 | Trava a resolução em 1920x1080 (Full HD). |
| itrate=9000 | 9.000 kbps garantem nitidez mesmo em jogos de alta velocidade (FPS/corrida). |
| codec=h264 | Aceleração por hardware GPU e compatibilidade universal. |
| roadcast=1 | Otimiza a topologia WebRTC para múltiplos espectadores simultâneos. |
| webcam=0 | Desativa a câmera por padrão. |
| utostart=1 | Inicia o stream no momento da seleção da janela/tela. |
| cleanoutput=1 | Oculta menus e botões da interface para máxima performance. |

### URL de View (Espectador)
`	ext
https://vdo.ninja/?view={ROOM_ID}&cleanoutput=1&pip=1&scale=1080&transparent=1
`
| Parâmetro | Finalidade |
| :--- | :--- |
| iew={ROOM_ID} | Conecta como espectador da transmissão. |
| cleanoutput=1 | Player minimalista, sem poluição visual. |
| pip=1 | Mantém o botão de Picture-in-Picture em evidência. |
| scale=1080 | Solicita reprodução na qualidade máxima da fonte. |
| 	ransparent=1 | Fundo neutro/escuro ideal para telas de transmissão. |

---

## 📄 Licença
Distribuído sob a licença MIT. Sinta-se livre para customizar e expandir!