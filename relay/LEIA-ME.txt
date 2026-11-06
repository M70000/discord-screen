================================================================================
     📡 TRANSMISSÃO DE TELA DISCORD (OBS RELAY) - GUIA DE INSTALAÇÃO RÁPIDA
================================================================================

Bem-vindo! Este pacote permite que você transmita a tela do seu jogo ou computador
direto para os seus amigos no Discord com qualidade máxima (1080p ou 1440p a 60 FPS)
sem nenhuma perda de nitidez e com baixíssima latência!

--------------------------------------------------------------------------------
 🚀 PASSO 1: INSTALAÇÃO EM 1 CLIQUE (AUTOMÁTICA)
--------------------------------------------------------------------------------

1. Dê dois cliques no arquivo:
   👉 "Instalador-Discord-Relay.exe" (ou "install-relay.bat")

2. O instalador fará TUDO sozinho para você:
   - Se você não tiver o OBS Studio, ele baixa e instala o OBS oficial automaticamente!
   - Baixa e prepara o servidor de streaming (MediaMTX + Cloudflare).
   - Instala o script diretamente na pasta do OBS Studio:
     C:\Users\<seu-usuario>\AppData\Roaming\obs-studio\plugin_config\scripts\discord-relay
   - Configura o servidor de transmissão (rtmp://localhost:1935/live) e a chave (live).
   - Pergunta o seu ID do Discord e já deixa salvo para você.

--------------------------------------------------------------------------------
 🎮 PASSO 2: ABRIR O OBS E TRANSMITIR
--------------------------------------------------------------------------------

1. Abra o OBS Studio.

2. Verifique se o script está carregado:
   - No topo do OBS, clique no menu: "Ferramentas" -> "Scripts".
   - Se o script "obs-stream-sync.lua" já estiver na lista, perfeito!
   - Se a lista estiver vazia, basta clicar no botão [+] e selecionar:
     %APPDATA%\obs-studio\plugin_config\scripts\discord-relay\obs-stream-sync.lua

3. Na tela de Scripts, confirme que o campo "ID do Discord" tem o seu ID de usuário.
   (Para pegar o ID: no Discord, clique com o botão direito no seu avatar -> "Copiar ID de Usuário").

4. Adicione o seu jogo ou tela na lista de "Fontes" do OBS (Captura de Jogo ou Captura de Tela).

5. Clique no botão "INICIAR TRANSMISSÃO"!

--------------------------------------------------------------------------------
 ✨ O QUE ACONTECE A SEGUIR:
--------------------------------------------------------------------------------
- O bot envia automaticamente uma mensagem no canal #telamento avisando a galera!
- A mensagem mostra a foto do seu perfil do Discord, seu nome e a resolução real da sua tela.
- A mensagem tira um print da sua live aos 10 segundos e atualiza o preview a cada 3 minutos!
- O seu apelido no Discord ganha a tag "🔴 LIVE" enquanto você estiver transmitindo.
- Quando você clicar em "Interromper Transmissão", o bot encerra a live e restaura o seu apelido original!

Dúvidas ou problemas? Fale com a gente no canal do Discord!
================================================================================
