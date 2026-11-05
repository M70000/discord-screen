# Design Document: Transmissão de Tela via OBS Studio + Relay Local (MediaMTX + Cloudflare Tunnel)

**Data:** 2026-11-05  
**Status:** Pronto para Aprovação  
**Autor:** DeepSeek Harness & Apollo  

---

## 1. Contexto & Motivação (Intent & Why)

O bot do Discord atualmente utiliza o **VDO.ninja** (WebRTC P2P) para contornar as limitações de qualidade (720p 30fps) do compartilhamento de tela nativo do Discord no Brasil. No entanto, o VDO.ninja tem se mostrado instável: taxa de quadros oscilante, travamentos frequentes e falhas de conexão entre os pares via CGNAT.

A maioria dos amigos do grupo já possui o **OBS Studio** instalado. O OBS oferece captura com aceleração de hardware (NVENC, AMF, QuickSync), estabilidade em 1080p @ 60 FPS e isolamento perfeito do áudio do jogo (sem eco da chamada do Discord).

O objetivo deste projeto é substituir integralmente o VDO.ninja por uma solução de **Relay Local com OBS Studio**, sem custos, com largura de banda ilimitada e automação total: o streamer apenas abre o OBS e clica em "Iniciar Transmissão". O bot detecta a live sozinho e publica o link para a galera assistir no canal `#telamento`.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos (Goals)
1. **Custo Zero & Tráfego Ilimitado:** R$ 0,00 de custo fixo, sem limites de gigabytes ou tempo de live.
2. **Zero Fricção no Streamer:** O streamer não precisa abrir terminais ou múltiplos programas. Um script interno em Lua do OBS Studio gerencia os binários silenciosamente em segundo plano.
3. **Sem Abertura de Portas (CGNAT-friendly):** O `cloudflared` cria um túnel HTTPS efêmero seguro sem exigir portas abertas no roteador.
4. **Anúncio Automático no Canal `#telamento`:** Ao iniciar a live no OBS, o bot publica automaticamente o Embed com botão de assistir no canal `#telamento`.
5. **Comando `/stream` Reativo e Informativo:**
   - Se o usuário já estiver transmitindo no OBS: republica/exibe o link e botão da live ativa.
   - Se o usuário estiver offline no OBS: exibe um guia rápido com os dados a serem colados no OBS e link para baixar o script.
6. **Comando `/endstream`:** Permite desativar a transmissão ativa e restaurar o apelido do streamer pelo Discord.
7. **Player Web Completo:** Interface dark theme moderna com Low-Latency HLS (delay ~1.5s), suporte a Tela Cheia, Picture-in-Picture (PiP) nativo e controles de volume.

### Não-Objetivos (Non-Goals)
- **Transcodificação multi-bitrate na nuvem:** O relay repassa o vídeo com a codificação nativa da GPU do streamer sem sobrecarregar a máquina.
- **Gravação de VODs ou histórico:** Transmissões exclusivamente efêmeras e ao vivo.
- **Restream multi-plataforma:** Foco exclusivo no grupo de amigos do Discord.

### Anti-Objetivos (Anti-Goals)
- **Não deixar janelas pretas (CMD/PowerShell) abertas:** Todos os processos auxiliares rodam com janela oculta (`WindowStyle Hidden` / flags de background).
- **Não deixar processos órfãos:** Ao fechar o OBS ou parar a live, os processos do relay são finalizados.

---

## 3. Restrições (Constraints)

- **Custo:** R$ 0,00 obrigatório.
- **Ambiente dos streamers:** Windows 10/11 com OBS Studio (versão 28+).
- **Canal de Anúncio:** Canal de texto `#telamento` no servidor Discord.

---

## 4. Abordagens Consideradas (Approaches)

| Abordagem | Custos / Limites | Complexidade | Decisão |
| :--- | :--- | :--- | :--- |
| **Opção 1: LiveKit Cloud (Nuvem WebRTC)** | Grátis até 50 GB/mês (~15h). Pago após cota. | Baixa. | **Descartada:** Cota insuficiente para uso diário. |
| **Opção 2: Relay Local + Cloudflare Tunnel + Script OBS (MediaMTX)** | Grátis e Ilimitado. Sem cadastro necessário. | Média. | **ESCOLHIDA:** Autonomia total, zero custos, performance da GPU local. |
| **Opção 3: VPS Dedicada Gratuita (Oracle Cloud)** | Grátis (Always Free). | Alta (exige cartão, setup de Linux). | **Descartada:** Exige cartão de crédito e configuração de VPS. |

---

## 5. Arquitetura Detalhada & Decisões de Engenharia

### 5.1. Ciclo de Vida dos Processos Locais (Decisão de Engenharia)
Para evitar o erro `WSAECONNREFUSED` no OBS ao clicar em "Iniciar Transmissão", o script Lua do OBS adota a seguinte estratégia:
- **`mediamtx.exe`:** É inicializado no evento `script_load` do OBS (consome menos de 15 MB de RAM e 0% de CPU enquanto ocioso). Isso garante que a porta RTMP `1935` esteja imediatamente disponível para conexão assim que o streamer clicar em "Iniciar Transmissão". É encerrado no `script_unload` (quando o OBS fecha).
- **`cloudflared.exe`:** É acionado **apenas** no evento `OBS_FRONTEND_EVENT_STREAMING_STARTED`. Assim, o túnel público só existe enquanto a live estiver ativa. No evento `OBS_FRONTEND_EVENT_STREAMING_STOPPED`, o túnel é encerrado imediatamente.

### 5.2. Comunicação OBS -> Bot do Discord
- O bot do Discord hospeda um servidor HTTP leve (porta configurável, padrão `3000` ou a porta atribuída pelo host no Render).
- O script Lua do OBS possui uma tela de propriedades dentro do OBS (*Ferramentas > Scripts*) onde o usuário preenche uma única vez:
  - `ID do Discord` (ex: `123456789012345678`)
  - `URL do Bot` (ex: `https://meu-bot.onrender.com` ou IP local)
  - `Chave Secreta` (`OBS_WEBHOOK_SECRET` para segurança)
- Ao iniciar a live e capturar a URL do Cloudflare Tunnel, o script envia:
  `POST /api/stream/start` com `{ userId, streamUrl, secret }`.
- Ao parar a live no OBS, o script envia:
  `POST /api/stream/stop` com `{ userId, secret }`.

### 5.3. Comportamento no Discord
1. **Ao receber `/api/stream/start`:**
   - O bot busca o canal de texto `#telamento` no servidor (via `ANNOUNCEMENT_CHANNEL_ID` configurado no `.env` ou busca pelo nome `telamento`).
   - Se o streamer estiver em um canal de voz, adiciona o sufixo `| 🔴 LIVE` ao apelido dele.
   - Envia um Embed elegante no `#telamento` com título *"📺 Transmissão de Tela Ao Vivo"*, mencionando o streamer, com botões:
     - 👁️ **Assistir no Navegador (PiP)**: Abre a página do Player Web.
     - 📱 **Link Direto (Celular)**: Link de fallback.
2. **Ao receber `/api/stream/stop`:**
   - O bot atualiza o Embed do canal `#telamento` para *"⏹️ Transmissão Encerrada"*, desativa os botões e restaura o apelido original do streamer.
3. **Comando `/stream`:**
   - Se o usuário já tiver uma live ativa (detectada via OBS): o bot responde com o link e botões da live ativa.
   - Se o usuário estiver offline no OBS: o bot responde de forma efêmera com instruções claras de como conectar o OBS ao relay e o status "Nenhuma live detectada no momento".
4. **Comando `/endstream`:**
   - Encerra a sessão ativa no Discord, restaura o apelido e desativa os botões.

### 5.4. Player Web Customizado
- O bot servirá um player web leve em `GET /watch/:userId` ou `GET /live/:streamId`.
- O player embutirá a biblioteca `Hls.js` configurada em modo Low-Latency (`lowLatencyMode: true`, `liveSyncDurationCount: 1`), mantendo o delay entre 1 e 2 segundos.
- Interface escura moderna (*dark mode*), com botão de Picture-in-Picture flutuante (PiP), modo cinema e controles nativos de áudio.

---

## 6. O que fica a cargo da implementação (What's Left to the Builder)

- **Pacote do Streamer (`relay/`):**
  - Script `obs-stream-sync.lua` com interface gráfica amigável de configuração dentro do OBS.
  - Script de instalação de 1 clique (`install-relay.bat` / PowerShell) que baixa automaticamente os executáveis portáteis `mediamtx.exe` e `cloudflared.exe` de seus releases oficiais do GitHub, sem exigir nada do usuário.
- **Servidor Web do Bot:**
  - Integrar `express` no bot para tratar as rotas `/api/stream/start`, `/api/stream/stop` e servir a rota estática `/watch/:streamId`.
- **Frontend do Player Web:**
  - Código HTML/CSS/JS limpo em `public/player.html`.
- **Limpeza do Código Legado:**
  - Remover dependências e URLs do VDO.ninja (`vdoBuilder.js`), adaptando `streamStore.js` e `streamManager.js` para o novo modelo de dados.
